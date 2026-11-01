// Every URL the app calls, in one place. Each path is checked against the generated contract (`keyof paths`),
// so a renamed or removed endpoint breaks the build instead of a user's request.
import type { paths } from "./api-types";

type ContractPath = keyof paths;

const GOVERNANCE = "/api/admin/governance" as const;

export const API_PATH = {
  contracts: "/api/contracts",
  examples: "/api/examples",
  analyze: "/api/analyze",
  feedback: "/api/feedback",
  session: "/api/session",
  sessionCredentials: "/api/session/credentials",
  adminSession: "/api/admin/session",
  adminConversations: "/api/admin/conversations",
  adminConversationStats: "/api/admin/conversations/stats",
  adminCatalog: "/api/admin/catalog",
  adminContracts: "/api/admin/contracts",
  adminDocuments: "/api/admin/documents",
  adminAudit: "/api/admin/audit",
  governanceSummary: `${GOVERNANCE}/summary`,
  governanceEvents: `${GOVERNANCE}/events`,
  governancePolicy: `${GOVERNANCE}/policy`,
} as const satisfies Record<string, ContractPath>;

function fill(template: ContractPath, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

export const conversationPath = (requestId: string) =>
  fill("/api/admin/conversations/{request_id}", { request_id: requestId });
export const documentVersionsPath = (documentId: string) =>
  fill("/api/admin/documents/{document_id}/versions", { document_id: documentId });
export const versionPath = (versionId: string) => fill("/api/admin/versions/{version_id}", { version_id: versionId });
export const versionChunksPath = (versionId: string) =>
  fill("/api/admin/versions/{version_id}/chunks", { version_id: versionId });
export const versionActivatePath = (versionId: string) =>
  fill("/api/admin/versions/{version_id}/activate", { version_id: versionId });
export const versionWithdrawPath = (versionId: string) =>
  fill("/api/admin/versions/{version_id}/withdraw", { version_id: versionId });
export const versionReindexPath = (versionId: string) =>
  fill("/api/admin/versions/{version_id}/reindex", { version_id: versionId });

export type Query = Record<string, string | number | undefined>;

/** Append a query string, skipping undefined values. */
export function withQuery(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}
