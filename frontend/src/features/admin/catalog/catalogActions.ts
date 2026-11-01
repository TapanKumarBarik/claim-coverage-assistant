import type { AdminApi } from "../../../api/admin";
import type { Chunk, DocumentVersion } from "../../../api/types";
import type { MessageKey } from "../../../i18n/messages";

/** Changes to a version that ask "are you sure?" first. */
export const CATALOG_ACTION = { ACTIVATE: "activate", WITHDRAW: "withdraw", DELETE: "delete" } as const;
export type CatalogAction = (typeof CATALOG_ACTION)[keyof typeof CATALOG_ACTION];

export interface PendingAction {
  action: CatalogAction;
  version: DocumentVersion;
}

export interface ChunkPreviewData {
  version: DocumentVersion;
  chunks: Chunk[];
}

export interface UploadedVersion {
  documentId: string;
  version: DocumentVersion;
}

export const CATALOG_ACTION_LABEL: Record<CatalogAction, MessageKey> = {
  activate: "action.activate",
  withdraw: "action.withdraw",
  delete: "action.delete",
};

export const CATALOG_ACTION_CONFIRM: Record<CatalogAction, MessageKey> = {
  activate: "confirm.activate",
  withdraw: "confirm.withdraw",
  delete: "confirm.delete",
};

/** What each confirmed action does on the server. */
export const CATALOG_ACTION_EXECUTE: Record<CatalogAction, (api: AdminApi, versionId: string) => Promise<unknown>> = {
  activate: (api, versionId) => api.activate(versionId),
  withdraw: (api, versionId) => api.withdraw(versionId),
  delete: (api, versionId) => api.remove(versionId),
};
