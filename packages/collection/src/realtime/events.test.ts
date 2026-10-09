import { describe, expect, it } from 'vitest';

import { parseCollectionChange } from './events';

const itemId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const tagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';

describe('parseCollectionChange', () => {
  it('reads item changes, using the old row for deletes', () => {
    expect(
      parseCollectionChange({
        table: 'collection_items',
        operation: 'INSERT',
        record: { id: itemId, external_id: 'movie:27205' },
        old_record: null,
      }),
    ).toEqual({ table: 'collection_items', operation: 'INSERT', itemId });
    expect(
      parseCollectionChange({
        table: 'collection_items',
        operation: 'DELETE',
        record: null,
        old_record: { id: itemId },
      }),
    ).toEqual({ table: 'collection_items', operation: 'DELETE', itemId });
  });

  it('reads tag link changes as changes of the linked item', () => {
    expect(
      parseCollectionChange({
        table: 'collection_item_tags',
        operation: 'INSERT',
        record: { item_id: itemId, tag_id: tagId },
        old_record: null,
      }),
    ).toEqual({ table: 'collection_item_tags', operation: 'INSERT', itemId });
  });

  it('returns undefined for unknown payloads', () => {
    expect(
      parseCollectionChange({
        table: 'tags',
        operation: 'INSERT',
        record: { id: tagId },
        old_record: null,
      }),
    ).toBeUndefined();
    expect(parseCollectionChange('presence_state')).toBeUndefined();
  });
});
