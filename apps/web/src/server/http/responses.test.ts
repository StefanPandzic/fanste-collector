import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchQuerySchema, searchResponseSchema } from '@fanste/core';

import { GatewayError } from '../errors';
import { errorResponse, jsonOk, parseInput } from './responses';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorResponse', () => {
  it('answers a GatewayError with its status, body and Retry-After', async () => {
    const response = errorResponse(
      new GatewayError('rate_limited', 'Too many requests. Try again shortly.', {
        retryAfterSeconds: 30,
      }),
      'search',
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({
      error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' },
    });

    const notFound = errorResponse(
      new GatewayError('not_found', 'tmdb has no such item.', { provider: 'tmdb' }),
      'items',
    );
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toHaveProperty('error.provider', 'tmdb');
  });

  it('answers other errors with internal without leaking the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = errorResponse(new Error('connection to db.internal:5432 refused'), 'search');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'internal', message: 'Something went wrong.' },
    });
  });
});

describe('parseInput', () => {
  it('returns the parsed input or throws bad_request', () => {
    expect(parseInput(searchQuerySchema, { category: 'movie', q: 'The Matrix' }).page).toBe(1);
    const invalid = { category: 'movie', q: '' };
    expect(() => parseInput(searchQuerySchema, invalid)).toThrow(/^q: /);
    expect(() => parseInput(searchQuerySchema, invalid)).toThrow(
      expect.objectContaining({ code: 'bad_request' }),
    );
  });
});

describe('jsonOk', () => {
  it('sends the validated data with the Cache-Control header', async () => {
    const data = { results: [], page: 1, totalPages: 0, totalResults: 0 };
    const response = jsonOk(searchResponseSchema, data, 'private, max-age=300');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(await response.json()).toEqual(data);
  });
});
