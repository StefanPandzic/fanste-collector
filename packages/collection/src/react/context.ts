import { createContext, use } from 'react';

import type { CollectionError } from '../errors';
import type { ApiClient } from '@fanste/api-client';
import type { FansteSupabaseClient } from '@fanste/supabase';

export interface CollectionContextValue {
  /** Supabase client acting as the signed-in user (RLS applies). */
  client: FansteSupabaseClient;
  /** Gateway client, for metadata (adding items, filling in missing metadata). */
  api: ApiClient;
  userId: string;
  /** Called when a mutation fails and its optimistic update is rolled back, e.g. to show a toast. */
  onError?: (error: CollectionError) => void;
  /** Refs (`provider:externalId`) the gateway reported as `not_found`; never requested again. */
  notFoundRefs: Set<string>;
}

export const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollectionContext(): CollectionContextValue {
  const value = use(CollectionContext);
  if (!value) throw new Error('Collection hooks must be used inside <CollectionProvider>.');
  return value;
}
