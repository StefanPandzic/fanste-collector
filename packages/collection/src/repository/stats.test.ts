import { describe, expect, it, vi } from 'vitest';

import { getStats } from './stats';

import type { FansteSupabaseClient } from '@fanste/supabase';

const NOW = new Date('2026-10-10T12:00:00Z');

describe('getStats', () => {
  it('takes the months in UTC when Postgres doesn’t know the time zone', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'not recognized' } })
      .mockResolvedValueOnce({ data: [], error: null });
    const client = { rpc } as unknown as FansteSupabaseClient;

    const stats = await getStats(client, { now: NOW, timeZone: 'Mars/Olympus' });

    expect(rpc).toHaveBeenNthCalledWith(1, 'collection_stats', { p_time_zone: 'Mars/Olympus' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'collection_stats', { p_time_zone: 'UTC' });
    expect(stats.addedByMonth.at(-1)).toEqual({ month: '2026-10', items: 0 });
  });
});
