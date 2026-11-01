import { useCallback, useState } from "react";
import type { AdminApi } from "../../../api/admin";
import type { DocumentVersion } from "../../../api/types";
import {
  CATALOG_ACTION,
  CATALOG_ACTION_EXECUTE,
  type CatalogAction,
  type ChunkPreviewData,
  type PendingAction,
  type UploadedVersion,
} from "./catalogActions";

/**
 * Everything the catalogue tab shares between its components: which change is waiting for confirmation, which
 * version is being previewed, the last upload, and whether a request is in flight. Only one confirmation and
 * one preview can be open at a time, across all documents.
 */
export function useCatalogState(api: AdminApi, reloadCatalog: () => void) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [preview, setPreview] = useState<ChunkPreviewData | null>(null);
  const [uploaded, setUploaded] = useState<UploadedVersion | null>(null);

  /** Run a request, then (by default) refresh the catalogue. Resolves to the result, or `undefined` after showing the error. */
  const run = useCallback(
    async <T>(task: () => Promise<T>, refresh = true): Promise<T | undefined> => {
      setWorking(true);
      setError(null);
      try {
        const result = await task();
        if (refresh) reloadCatalog();
        return result;
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        return undefined;
      } finally {
        setWorking(false);
      }
    },
    [reloadCatalog],
  );

  const confirmPending = useCallback(async () => {
    if (!pending) return;
    const { action, version } = pending;
    setPending(null);
    await run(() => CATALOG_ACTION_EXECUTE[action](api, version.id));
    if (action === CATALOG_ACTION.DELETE) {
      setUploaded((current) => (current?.version.id === version.id ? null : current));
      setPreview((current) => (current?.version.id === version.id ? null : current));
    }
  }, [api, pending, run]);

  const openPreview = useCallback(
    async (version: DocumentVersion) => {
      const chunks = await run(() => api.chunks(version.id), false);
      if (chunks) setPreview({ version, chunks });
    },
    [api, run],
  );

  return {
    api,
    working,
    error,
    pending,
    preview,
    uploaded,
    run,
    requestConfirm: (action: CatalogAction, version: DocumentVersion) => setPending({ action, version }),
    cancelConfirm: () => setPending(null),
    confirmPending,
    openPreview,
    closePreview: () => setPreview(null),
    setUploaded,
  };
}

export type CatalogState = ReturnType<typeof useCatalogState>;
