import { toCollectionError } from '../errors';
import { toCollectionStats } from './mappers';

import type { CollectionStats } from './mappers';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** Counts per category and ownership status, and the estimated value, for the dashboard (FC-20). */
export async function getStats(client: FansteSupabaseClient): Promise<CollectionStats> {
  const { data, error } = await client.rpc('collection_stats');
  if (error) throw toCollectionError(error);
  return toCollectionStats(data);
}
