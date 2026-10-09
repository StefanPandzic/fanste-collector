import { describe, expect, it } from 'vitest';

import { collectionKeys, collectionMutationKey, missingMetadataKey } from './query-keys';

const userId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('collectionKeys', () => {
  it('gives equal queries the same list key', () => {
    expect(collectionKeys.list(userId, {})).toEqual(
      collectionKeys.list(userId, { sort: 'added_desc', page: 1, pageSize: 60 }),
    );
    expect(collectionKeys.list(userId, { page: 2 })).not.toEqual(collectionKeys.list(userId, {}));
  });

  it('scopes every key to the user', () => {
    expect(collectionKeys.list(userId, {}).slice(0, 3)).toEqual(['collection', userId, 'list']);
    expect(collectionKeys.detail(userId, 'item-1')).toEqual([
      'collection',
      userId,
      'item',
      'item-1',
    ]);
  });
});

describe('collectionMutationKey / missingMetadataKey', () => {
  it('keeps the keys outside the collection prefix', () => {
    const prefix = collectionKeys.all(userId);
    expect(collectionMutationKey(userId).slice(0, 2)).not.toEqual(prefix);
    expect(missingMetadataKey(userId, ['tmdb:movie:603']).slice(0, 2)).not.toEqual(prefix);
    expect(missingMetadataKey(userId, ['tmdb:movie:603'])).toContain(userId);
  });
});
