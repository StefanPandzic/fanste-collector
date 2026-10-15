import { coverFetchUrl, fitWithin } from '@fanste/core';

import type { FontNeeds, PdfCover, PdfFonts } from '@fanste/export';

// What the PDF export (FC-26) loads in the browser besides the items: the fonts from `public/fonts`
// and the covers, scaled down through a canvas so a 500-item catalog stays a few MB.

const FONT_FILES = {
  regular: '/fonts/NotoSans-Regular.ttf',
  bold: '/fonts/NotoSans-Bold.ttf',
  sc: '/fonts/NotoSansSC-Regular.ttf',
  kr: '/fonts/NotoSansKR-Regular.ttf',
} as const;

/** Longest side of a cover in the PDF, in pixels (about 230 dpi in the catalog's grid). */
export const COVER_MAX_PIXELS = 300;
const COVER_QUALITY = 0.75;
/** Covers loaded at once. */
const COVER_CONCURRENCY = 6;
/**
 * Times a `429` from the image proxy (its per-user limit) is waited out before the cover becomes a
 * placeholder, and the longest wait.
 */
const RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_AFTER_S = 10;
const MAX_RETRY_AFTER_S = 60;

// Fonts are kept for the next export; the CJK ones are 6–10 MB.
const fontCache = new Map<string, Promise<Uint8Array>>();

function loadFont(path: string, signal?: AbortSignal): Promise<Uint8Array> {
  let font = fontCache.get(path);
  if (!font) {
    font = fetch(path, { signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Font ${path}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    });
    // A failed or cancelled load is tried again next time.
    font.catch(() => fontCache.delete(path));
    fontCache.set(path, font);
  }
  return font;
}

/** Noto Sans, plus the CJK fonts the text needs. */
export async function loadPdfFonts(needs: FontNeeds, signal?: AbortSignal): Promise<PdfFonts> {
  const [regular, bold, sc, kr] = await Promise.all([
    loadFont(FONT_FILES.regular, signal),
    loadFont(FONT_FILES.bold, signal),
    needs.sc ? loadFont(FONT_FILES.sc, signal) : undefined,
    needs.kr ? loadFont(FONT_FILES.kr, signal) : undefined,
  ]);
  return { regular, bold, sc, kr };
}

/** Waits `ms`, or rejects at once when `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Fetches a cover, waiting out the image proxy's `429`s (`Retry-After`) a few times. */
async function fetchCover(url: string, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(coverFetchUrl(url), { signal, credentials: 'same-origin' });
    if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) return response;
    const retryAfter = Number(response.headers.get('retry-after')) || DEFAULT_RETRY_AFTER_S;
    await sleep(Math.min(retryAfter, MAX_RETRY_AFTER_S) * 1000, signal);
  }
}

/**
 * One cover as a small JPEG, or `null` when it can't be loaded or read (a host without CORS headers
 * that isn't proxied, a broken link): the PDF then draws a placeholder.
 */
async function loadCover(url: string, signal?: AbortSignal): Promise<PdfCover | null> {
  try {
    const response = await fetchCover(url, signal);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, COVER_MAX_PIXELS);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      // JPEG has no transparency: a transparent PNG gets a white background, like the paper.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', COVER_QUALITY),
      );
      if (!blob) return null;
      return { data: new Uint8Array(await blob.arrayBuffer()), format: 'JPEG', width, height };
    } finally {
      bitmap.close();
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

/** The covers of `urls`, a few at a time; `onProgress` counts the ones done. */
export async function loadCovers(
  urls: readonly string[],
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number) => void } = {},
): Promise<Map<string, PdfCover | null>> {
  const covers = new Map<string, PdfCover | null>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (url === undefined) break;
      covers.set(url, await loadCover(url, signal));
      onProgress?.(covers.size);
    }
  };
  await Promise.all(Array.from({ length: Math.min(COVER_CONCURRENCY, urls.length) }, worker));
  signal?.throwIfAborted();
  return covers;
}
