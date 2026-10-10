import { toCollectionError } from '../errors';
import { toCollectionStats } from './mappers';

import type { CollectionStats, StatsClock } from './mappers';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** Postgres `invalid_parameter_value`: e.g. a time zone name its tz database doesn't know. */
const INVALID_PARAMETER = '22023';

/**
 * Counts per category and ownership status, the estimated value and the copies added per month,
 * for the dashboard (FC-20), in one aggregate call. Months are taken in `clock.timeZone`; when
 * Postgres doesn't know that zone, they are taken in UTC instead.
 */
export async function getStats(
  client: FansteSupabaseClient,
  clock: StatsClock = { now: new Date(), timeZone: 'UTC' },
): Promise<CollectionStats> {
  const { data, error } = await client.rpc('collection_stats', { p_time_zone: clock.timeZone });
  if (error?.code === INVALID_PARAMETER && clock.timeZone !== 'UTC') {
    return getStats(client, { ...clock, timeZone: 'UTC' });
  }
  if (error) throw toCollectionError(error);
  return toCollectionStats(data, clock);
}
