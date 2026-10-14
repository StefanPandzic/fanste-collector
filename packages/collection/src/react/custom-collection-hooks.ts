import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { customCollectionPatchSchema } from '@fanste/core';

import { useCollectionContext } from './context';
import { cancelRefetches, mutationOptions } from './mutations';
import { collectionKeys } from './query-keys';
import {
  createCustomCollection,
  deleteCustomCollection,
  listCustomCollections,
  reorderCustomCollections,
  updateCustomCollection,
} from '../repository/custom-collections';

import type { Undo } from './mutations';
import type { CustomCollection, CustomCollectionInput, CustomCollectionPatch } from '@fanste/core';

// The user's custom collections (FC-13). Realtime invalidates them when another device changes one.

/** The user's custom collections, in their order. */
export function useCustomCollections() {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: collectionKeys.customCollections(userId),
    queryFn: () => listCustomCollections(client),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** `collections` in the order of `ids`; collections missing from `ids` keep their place at the end. */
export function orderCollections(
  collections: readonly CustomCollection[],
  ids: readonly string[],
): CustomCollection[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return collections
    .map((collection, index) => ({ collection, index }))
    .sort(
      (a, b) =>
        (position.get(a.collection.id) ?? ids.length + a.index) -
        (position.get(b.collection.id) ?? ids.length + b.index),
    )
    .map(({ collection }, index) => ({ ...collection, sortOrder: index }));
}

/**
 * Creates, edits, reorders and deletes custom collections. Edits, reordering and deletes show at
 * once and are undone on failure; a new collection shows once it is stored (it needs its ID).
 * Deleting a collection deletes its items too: confirm with their count first.
 */
export function useCustomCollectionMutations() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();
  const options = mutationOptions(queryClient, context);
  const key = collectionKeys.customCollections(userId);

  const cached = () => queryClient.getQueryData<CustomCollection[]>(key);
  const setCollections = (update: (list: CustomCollection[]) => CustomCollection[]) =>
    queryClient.setQueryData<CustomCollection[]>(key, (list) => (list ? update(list) : list));

  const create = useMutation({
    ...options,
    mutationFn: (input: CustomCollectionInput) => createCustomCollection(client, input),
    onSuccess: (collection) => {
      setCollections((list) =>
        list.some((entry) => entry.id === collection.id) ? list : [...list, collection],
      );
    },
  });

  const update = useMutation({
    ...options,
    mutationFn: ({ id, patch }: { id: string; patch: CustomCollectionPatch }) =>
      updateCustomCollection(client, id, patch),
    onMutate: async ({ id, patch }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const parsed = customCollectionPatchSchema.safeParse(patch);
      const before = cached()?.find((collection) => collection.id === id);
      if (!parsed.success || !before) return () => undefined;
      const { name, description, icon } = parsed.data;
      setCollections((list) =>
        list.map((collection) =>
          collection.id === id
            ? {
                ...collection,
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(icon !== undefined && { icon }),
              }
            : collection,
        ),
      );
      return () => setCollections((list) => list.map((c) => (c.id === id ? before : c)));
    },
  });

  const remove = useMutation({
    ...options,
    mutationFn: (id: string) => deleteCustomCollection(client, id),
    onMutate: async (id): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const list = cached() ?? [];
      const index = list.findIndex((collection) => collection.id === id);
      const before = list[index];
      setCollections((current) => current.filter((collection) => collection.id !== id));
      return () => {
        if (!before) return;
        setCollections((current) =>
          current.some((collection) => collection.id === id)
            ? current
            : current.toSpliced(index, 0, before),
        );
      };
    },
  });

  const reorder = useMutation({
    ...options,
    mutationFn: (ids: readonly string[]) => reorderCustomCollections(client, ids),
    onMutate: async (ids): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const before = cached();
      setCollections((list) => orderCollections(list, ids));
      return () => {
        if (before) queryClient.setQueryData(key, before);
      };
    },
  });

  return { create, update, remove, reorder };
}
