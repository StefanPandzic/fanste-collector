import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeToCollectionChanges } from './subscribe';

import type { FansteSupabaseClient } from '@fanste/supabase';

const userId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const topic = `user:${userId}`;

interface FakeChannel {
  subTopic: string;
  options: unknown;
  broadcast?: (message: { payload: unknown }) => void;
  status?: (state: string) => void;
  on: (
    type: string,
    filter: unknown,
    callback: (message: { payload: unknown }) => void,
  ) => FakeChannel;
  subscribe: (callback: (state: string) => void) => FakeChannel;
}

function createFakeClient(leftovers: FakeChannel[] = []) {
  const channels: FakeChannel[] = [...leftovers];
  const created: FakeChannel[] = [];
  const realtime = { setAuth: vi.fn(async () => {}) };
  const removeChannel = vi.fn(async (channel: FakeChannel) => {
    await Promise.resolve();
    const index = channels.indexOf(channel);
    if (index !== -1) channels.splice(index, 1);
    return 'ok';
  });
  const channel = vi.fn((subTopic: string, options: unknown) => {
    const fake: FakeChannel = {
      subTopic,
      options,
      on(_type, _filter, callback) {
        fake.broadcast = callback;
        return fake;
      },
      subscribe(callback) {
        fake.status = callback;
        return fake;
      },
    };
    channels.push(fake);
    created.push(fake);
    return fake;
  });
  const client = {
    realtime,
    getChannels: () => [...channels],
    removeChannel,
    channel,
  } as unknown as FansteSupabaseClient;
  return { client, channels, created, realtime, removeChannel, channel };
}

function fakeChannel(subTopic: string): FakeChannel {
  const fake: FakeChannel = {
    subTopic,
    options: {},
    on: () => fake,
    subscribe: () => fake,
  };
  return fake;
}

describe('subscribeToCollectionChanges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins the private user topic and forwards valid changes', async () => {
    const fake = createFakeClient();
    const onChange = vi.fn();
    subscribeToCollectionChanges(fake.client, userId, { onChange });
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.realtime.setAuth).toHaveBeenCalled();
    expect(fake.channel).toHaveBeenCalledWith(topic, { config: { private: true } });
    fake.created[0]?.broadcast?.({
      payload: {
        table: 'collection_items',
        operation: 'INSERT',
        record: { id: 'x' },
        old_record: null,
      },
    });
    expect(onChange).toHaveBeenCalledWith({
      table: 'collection_items',
      operation: 'INSERT',
      itemId: 'x',
    });
  });

  it('reconnects after a failed channel and reports the resubscribe', async () => {
    const fake = createFakeClient();
    const onResubscribed = vi.fn();
    subscribeToCollectionChanges(fake.client, userId, { onChange: vi.fn(), onResubscribed });
    await vi.advanceTimersByTimeAsync(0);
    const first = fake.created[0];
    first?.status?.('SUBSCRIBED');
    expect(onResubscribed).not.toHaveBeenCalled();

    first?.status?.('CHANNEL_ERROR');
    expect(fake.removeChannel).toHaveBeenCalledWith(first);
    await vi.advanceTimersByTimeAsync(999);
    expect(fake.created).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.created).toHaveLength(2);

    fake.created[1]?.status?.('SUBSCRIBED');
    expect(onResubscribed).toHaveBeenCalledTimes(1);
  });

  it('removes a leftover channel for the topic before joining', async () => {
    const leftover = fakeChannel(topic);
    const fake = createFakeClient([leftover]);
    subscribeToCollectionChanges(fake.client, userId, { onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.removeChannel).toHaveBeenCalledWith(leftover);
    expect(fake.removeChannel.mock.invocationCallOrder[0]).toBeLessThan(
      fake.channel.mock.invocationCallOrder[0] ?? 0,
    );
    expect(fake.channels).not.toContain(leftover);
    expect(fake.created).toHaveLength(1);
  });

  it('removes the channel and stops reconnecting on unsubscribe', async () => {
    const fake = createFakeClient();
    const unsubscribe = subscribeToCollectionChanges(fake.client, userId, { onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    const first = fake.created[0];
    first?.status?.('SUBSCRIBED');
    unsubscribe();
    first?.status?.('CLOSED');
    await vi.advanceTimersByTimeAsync(5000);

    expect(fake.removeChannel).toHaveBeenCalledWith(first);
    expect(fake.created).toHaveLength(1);
  });
});
