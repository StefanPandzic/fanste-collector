import { useCallback } from 'react';

import { useCollectionContext } from './context';
import { loadExportItems } from '../repository/export';

import type { ExportItems, ExportProgress, ExportScope } from '../repository/export';

export interface LoadExportOptions {
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * A function that loads every item of an export with its metadata (FC-25). It reads the database
 * fresh, not the query cache, so the file has the current data.
 */
export function useLoadExportItems() {
  const { client, api } = useCollectionContext();
  return useCallback(
    (scope: ExportScope, options: LoadExportOptions = {}): Promise<ExportItems> =>
      loadExportItems(client, scope, {
        getItemsBatch: (refs, requestOptions) => api.getItemsBatch(refs, requestOptions),
        ...options,
      }),
    [client, api],
  );
}
