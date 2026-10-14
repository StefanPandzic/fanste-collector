import { CUSTOM_IMAGE_MAX_BYTES, fitWithin } from '@fanste/core';

/** WebP qualities tried in turn until the image fits `CUSTOM_IMAGE_MAX_BYTES`. */
const QUALITIES = [0.85, 0.75, 0.6, 0.45];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

/**
 * Scales an image down to at most `CUSTOM_IMAGE_MAX_DIMENSION` px and compresses it to WebP of at
 * most `CUSTOM_IMAGE_MAX_BYTES` (FC-13), in the browser (also in the desktop app's window), so
 * uploads stay small. Rejects if the file isn't a decodable image or can't be made small enough.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas.');
    context.drawImage(bitmap, 0, 0, width, height);
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality);
      // A browser without a WebP encoder falls back to PNG; the bucket only stores WebP from here.
      if (blob && blob.type === 'image/webp' && blob.size <= CUSTOM_IMAGE_MAX_BYTES) return blob;
    }
    throw new Error('The image could not be compressed enough.');
  } finally {
    bitmap.close();
  }
}
