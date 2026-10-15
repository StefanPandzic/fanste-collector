import { describe, expect, it, vi } from 'vitest';

import { fetchProxiedImage, parseImageUrl } from './image-proxy';
import { IMAGE_PROXY } from './limits';

const discogsCover = 'https://i.discogs.com/Zk3d9pQ/rs:fit/h:600/w:600/R-2607424-1288530830.jpeg';
const userAgent = 'FansteCollector/0.1 +https://fanste.app';
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

function fakeFetch(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  return fetchImpl;
}

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

function jpeg() {
  return new Response(jpegBytes, { headers: { 'content-type': 'image/jpeg' } });
}

describe('parseImageUrl', () => {
  it('parses an allowed image URL and rejects other hosts', () => {
    expect(parseImageUrl(discogsCover).hostname).toBe('i.discogs.com');
    expect(() => parseImageUrl('https://image.tmdb.org/t/p/w185/cover.jpg')).toThrow(
      /not supported/,
    );
    expect(() => parseImageUrl(null)).toThrow(expect.objectContaining({ code: 'bad_request' }));
  });
});

describe('fetchProxiedImage', () => {
  it('returns the image and its content type', async () => {
    const fetchImpl = fakeFetch(jpeg());
    const image = await fetchProxiedImage(new URL(discogsCover), { userAgent, fetchImpl });
    expect(image).toEqual({ body: jpegBytes, contentType: 'image/jpeg' });
    expect(fetchImpl.mock.calls[0]?.[1]).toHaveProperty('headers.User-Agent', userAgent);
  });

  it('follows redirects on allowed hosts only', async () => {
    const moved = 'https://i.discogs.com/Zk3d9pQ/R-2607424-1288530830-2.jpeg';
    const followed = fakeFetch(redirectTo(moved), jpeg());
    await expect(
      fetchProxiedImage(new URL(discogsCover), { userAgent, fetchImpl: followed }),
    ).resolves.toHaveProperty('contentType', 'image/jpeg');
    expect(followed.mock.calls[1]?.[0]).toEqual(new URL(moved));

    const escaped = fakeFetch(redirectTo('https://attacker.example/steal.jpeg'));
    await expect(
      fetchProxiedImage(new URL(discogsCover), { userAgent, fetchImpl: escaped }),
    ).rejects.toMatchObject({ code: 'provider_error' });
  });

  it('rejects missing images, other content and images over the size limit', async () => {
    const fetchWith = (response: Response) =>
      fetchProxiedImage(new URL(discogsCover), { userAgent, fetchImpl: fakeFetch(response) });
    await expect(fetchWith(new Response('Not Found', { status: 404 }))).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      fetchWith(new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
    ).rejects.toMatchObject({ code: 'provider_error' });
    await expect(
      fetchWith(
        new Response(new Uint8Array(IMAGE_PROXY.maxBytes + 1), {
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'provider_error' });
  });
});
