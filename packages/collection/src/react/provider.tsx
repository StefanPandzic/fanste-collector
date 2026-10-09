import { useMemo, useState, type ReactNode } from 'react';

import { CollectionContext } from './context';
import { useCollectionRealtime } from './realtime';

import type { CollectionError } from '../errors';
import type { ApiClient } from '@fanste/api-client';
import type { FansteSupabaseClient } from '@fanste/supabase';

export interface CollectionProviderProps {
  client: FansteSupabaseClient;
  api: ApiClient;
  userId: string;
  onError?: (error: CollectionError) => void;
  /** Subscribe to the user's Realtime changes (default `true`). */
  realtime?: boolean;
  children: ReactNode;
}

/**
 * Gives the collection hooks their clients and the user, and keeps the query cache in sync with
 * changes from other devices. Mount it once, inside a `QueryClientProvider`, for a signed-in user.
 */
export function CollectionProvider({
  client,
  api,
  userId,
  onError,
  realtime = true,
  children,
}: CollectionProviderProps) {
  const [notFoundRefs] = useState(() => new Set<string>());
  const value = useMemo(
    () => ({ client, api, userId, onError, notFoundRefs }),
    [client, api, userId, onError, notFoundRefs],
  );

  return (
    <CollectionContext value={value}>
      {realtime && <RealtimeSync />}
      {children}
    </CollectionContext>
  );
}

function RealtimeSync() {
  useCollectionRealtime();
  return null;
}
