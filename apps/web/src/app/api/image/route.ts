import { imageProxyUserAgent, imageRoute } from '@/server/gateway';
import { fetchProxiedImage, parseImageUrl } from '@/server/image-proxy';
import { CACHE_CONTROL } from '@/server/limits';

/**
 * `GET /api/image?url=`: a Discogs or BoardGameGeek cover, for the PDF export (FC-26). Their hosts
 * send no CORS headers, so the browser can't read the image itself.
 */
export const GET = imageRoute('image', async (request) => {
  const url = parseImageUrl(request.nextUrl.searchParams.get('url'));
  const image = await fetchProxiedImage(url, { userAgent: imageProxyUserAgent });
  return new Response(new Uint8Array(image.body), {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': CACHE_CONTROL.image,
      Vary: 'Authorization, Cookie',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
