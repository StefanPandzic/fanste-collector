import { describe, expect, it } from 'vitest';

import { DEFAULT_WEB_URL, resolveWebUrl } from './web-url';

describe('resolveWebUrl', () => {
  it('defaults to the Next.js dev server', () => {
    expect(resolveWebUrl(undefined).href).toBe(`${DEFAULT_WEB_URL}/`);
    expect(resolveWebUrl('').href).toBe(`${DEFAULT_WEB_URL}/`);
  });

  it('accepts https URLs', () => {
    expect(resolveWebUrl('https://app.example.com').origin).toBe('https://app.example.com');
  });

  it('accepts http only for loopback hosts', () => {
    expect(resolveWebUrl('http://127.0.0.1:3000').origin).toBe('http://127.0.0.1:3000');
    expect(() => resolveWebUrl('http://app.example.com')).toThrow(/https/);
  });

  it('rejects invalid URLs and other protocols', () => {
    expect(() => resolveWebUrl('not a url')).toThrow(/not a valid URL/);
    expect(() => resolveWebUrl('file:///C:/app/index.html')).toThrow(/https/);
  });
});
