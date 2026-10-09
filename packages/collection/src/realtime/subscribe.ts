import { reconnectDelay } from '../timing';
import { parseCollectionChange } from './events';

import type { CollectionChange } from './events';
import type { FansteSupabaseClient } from '@fanste/supabase';

export interface CollectionSubscriptionHandlers {
  onChange: (change: CollectionChange) => void;
  /**
   * Called when the channel is joined again after a drop. Changes made in between were missed, so
   * refetch everything.
   */
  onResubscribed?: () => void;
}

const FAILED_STATES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

/**
 * Subscribes to the user's private Broadcast topic `user:<id>`, where the FC-05 triggers send every
 * change of their items and tag links. A failed or closed channel is joined again with backoff.
 * Returns a function that unsubscribes.
 */
export function subscribeToCollectionChanges(
  client: FansteSupabaseClient,
  userId: string,
  { onChange, onResubscribed }: CollectionSubscriptionHandlers,
): () => void {
  let channel: ReturnType<FansteSupabaseClient['channel']> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let joinedBefore = false;
  let stopped = false;

  async function connect(): Promise<void> {
    // Private channels authorize with the user's JWT (RLS on `realtime.messages`). supabase-js
    // passes refreshed tokens on by itself afterwards.
    await client.realtime.setAuth();
    if (stopped) return;

    // `client.channel()` returns an existing channel with the same topic, and a removed channel stays
    // listed until the server confirms the leave. Reusing one that is still leaving would never
    // report a status again, so wait until any leftover (an earlier subscription, a remount) is gone.
    const topic = `user:${userId}`;
    for (const leftover of client.getChannels()) {
      if (leftover.subTopic === topic) await client.removeChannel(leftover);
    }
    if (stopped) return;

    const current = client
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: '*' }, ({ payload }) => {
        const change = parseCollectionChange(payload);
        if (change) onChange(change);
      });
    channel = current;

    current.subscribe((state) => {
      const status: string = state;
      // Ignore late callbacks of a channel that was already replaced or removed.
      if (stopped || current !== channel) return;
      if (status === 'SUBSCRIBED') {
        if (joinedBefore) onResubscribed?.();
        joinedBefore = true;
        attempt = 0;
      } else if (FAILED_STATES.has(status)) {
        reconnect();
      }
    });
  }

  function reconnect(): void {
    if (stopped || retryTimer !== undefined) return;
    const old = channel;
    channel = undefined;
    if (old) void client.removeChannel(old);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect().catch(reconnect);
    }, reconnectDelay(attempt++));
  }

  void connect().catch(reconnect);

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    if (channel) void client.removeChannel(channel);
    channel = undefined;
  };
}
