import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiClientError } from '@fanste/api-client';

import { CollectionError, collectionErrorMessage, toCollectionError } from './errors';

describe('toCollectionError', () => {
  it('maps Postgres and PostgREST codes', () => {
    const duplicate = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(toCollectionError(duplicate).code).toBe('duplicate');
    expect(toCollectionError({ code: '42501', message: 'permission denied' }).code).toBe(
      'forbidden',
    );
    expect(toCollectionError({ code: 'PGRST116', message: 'no rows returned' }).code).toBe(
      'not_found',
    );
  });

  it('maps zod, gateway and connection errors', () => {
    const zodError = z.uuid().safeParse('not-a-uuid').error;
    expect(toCollectionError(zodError).code).toBe('invalid');
    expect(toCollectionError(new ApiClientError(404, 'not_found', 'Not found.')).code).toBe(
      'not_found',
    );
    expect(
      toCollectionError(new ApiClientError(502, 'provider_error', 'TMDB failed.', 'tmdb')).code,
    ).toBe('provider_unavailable');
    expect(toCollectionError(new TypeError('Failed to fetch')).code).toBe('network');
  });

  it('returns CollectionErrors unchanged and wraps anything else as unknown', () => {
    const error = new CollectionError('duplicate', 'Already added.');
    expect(toCollectionError(error)).toBe(error);
    expect(toCollectionError(new Error('boom')).code).toBe('unknown');
    expect(
      toCollectionError(new TypeError("Cannot read properties of undefined (reading 'id')")).code,
    ).toBe('unknown');
  });
});

describe('collectionErrorMessage', () => {
  it('returns a user-facing message instead of the raw database text', () => {
    const message = collectionErrorMessage({
      code: '23505',
      message: 'duplicate key value violates unique constraint "collection_items_unique_copy"',
    });
    expect(message).toBe('That is already in your collection.');
  });
});
