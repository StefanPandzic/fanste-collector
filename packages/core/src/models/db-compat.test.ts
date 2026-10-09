import { describe, expectTypeOf, it } from 'vitest';

import type {
  ItemCategory,
  Json,
  MetadataCacheRow,
  MetadataProvider,
  OwnershipStatus,
} from './index';
import type { Database, Json as DbJson, Tables, TablesInsert } from '@fanste/supabase';

// Type-level checks: `pnpm typecheck` fails when core drifts from the generated database types.
// Regenerate them with `pnpm db:types` after a migration.
type DbEnums = Database['public']['Enums'];

describe('database compatibility', () => {
  it('mirrors the database enums', () => {
    expectTypeOf<ItemCategory>().toEqualTypeOf<DbEnums['item_category']>();
    expectTypeOf<MetadataProvider>().toEqualTypeOf<DbEnums['metadata_provider']>();
    expectTypeOf<OwnershipStatus>().toEqualTypeOf<DbEnums['ownership_status']>();
    expectTypeOf<Json>().toEqualTypeOf<DbJson>();
  });

  it('reads and writes metadata_cache rows', () => {
    expectTypeOf<Tables<'metadata_cache'>>().toExtend<MetadataCacheRow>();
    expectTypeOf<MetadataCacheRow>().toExtend<TablesInsert<'metadata_cache'>>();
  });
});
