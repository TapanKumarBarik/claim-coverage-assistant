import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { AUDIT_LIMIT, CONVERSATIONS_PAGE_SIZE, DEFAULT_WINDOW_HOURS, EVENTS_LIMIT } from "../constants/limits";
import { request, requestVoid } from "./client";
import { isApiError } from "./errors";
import {
  API_PATH,
  conversationPath,
  documentVersionsPath,
  versionActivatePath,
  versionChunksPath,
  versionPath,
  versionReindexPath,
  versionWithdrawPath,
  type Query,
} from "./paths";
import type {
  AdminLogin,
  AdminSessionStatus,
  AiEvent,
  AuditRecord,
  Catalog,
  Chunk,
  ContractAdmin,
  ConversationDetail,
  ConversationPage,
  CreateContract,
  CreateDocument,
  DocumentAdmin,
  DocumentVersion,
  FeedbackFilter,
  FeedbackStats,
  GovernancePolicy,
  GovernanceSummary,
  Outcome,
  UploadFields,
} from "./types";

/** Multipart field names, checked against the contract's upload body. */
const UPLOAD_FIELD = {
  FILE: "file",
  LABEL: "label",
  EFFECTIVE_FROM: "effective_from",
} as const satisfies Record<string, keyof UploadFields>;

export interface UploadInput {
  file: File;
  label: string;
  effectiveFrom: string;
}

export interface EventsQuery {
  outcome?: Outcome;
  limit?: number;
}

export interface ConversationsQuery {
  feedback?: FeedbackFilter;
  text?: string;
  offset?: number;
  limit?: number;
}

/**
 * Signing in and out. Kept apart from the guarded calls below: a refused password is an answer to show on the
 * sign-in form, not a session that ended. The password goes to the server once and is not kept anywhere; what
 * comes back is an HttpOnly cookie that scripts cannot read.
 */
export const adminSessionApi = {
  status: () => request<AdminSessionStatus>(API_PATH.adminSession),
  signIn: (password: string) =>
    request<AdminSessionStatus>(API_PATH.adminSession, { method: HTTP_METHOD.POST, json: { password } satisfies AdminLogin }),
  signOut: () => requestVoid(API_PATH.adminSession, { method: HTTP_METHOD.DELETE }),
};

export interface AdminApiOptions {
  /** Called when the server says the sign-in has ended, so the sign-in form can come back. */
  onUnauthorized?: () => void;
}

/** Admin endpoints. The browser's session cookie authenticates them. */
export function createAdminApi({ onUnauthorized }: AdminApiOptions = {}) {
  async function guarded<T>(call: Promise<T>): Promise<T> {
    try {
      return await call;
    } catch (error) {
      if (isApiError(error, ERROR_CODE.UNAUTHORIZED)) onUnauthorized?.();
      throw error;
    }
  }
  const get = <T>(path: string, query?: Query) => guarded(request<T>(path, { query }));
  const post = <T>(path: string) => guarded(request<T>(path, { method: HTTP_METHOD.POST }));
  const postJson = <T>(path: string, json: unknown) => guarded(request<T>(path, { method: HTTP_METHOD.POST, json }));

  return {
    catalog: () => get<Catalog>(API_PATH.adminCatalog),
    audit: () => get<AuditRecord[]>(API_PATH.adminAudit, { limit: AUDIT_LIMIT }),
    chunks: (versionId: string) => get<Chunk[]>(versionChunksPath(versionId)),
    createContract: (body: CreateContract) => postJson<ContractAdmin>(API_PATH.adminContracts, body),
    createDocument: (body: CreateDocument) => postJson<DocumentAdmin>(API_PATH.adminDocuments, body),
    upload: (documentId: string, { file, label, effectiveFrom }: UploadInput) => {
      const form = new FormData();
      form.set(UPLOAD_FIELD.FILE, file);
      form.set(UPLOAD_FIELD.LABEL, label);
      form.set(UPLOAD_FIELD.EFFECTIVE_FROM, effectiveFrom);
      return guarded(request<DocumentVersion>(documentVersionsPath(documentId), { method: HTTP_METHOD.POST, form }));
    },
    activate: (versionId: string) => post<DocumentVersion>(versionActivatePath(versionId)),
    withdraw: (versionId: string) => post<DocumentVersion>(versionWithdrawPath(versionId)),
    reindex: (versionId: string) => post<DocumentVersion>(versionReindexPath(versionId)),
    remove: (versionId: string) => guarded(requestVoid(versionPath(versionId), { method: HTTP_METHOD.DELETE })),

    conversations: ({ feedback, text, offset = 0, limit = CONVERSATIONS_PAGE_SIZE }: ConversationsQuery = {}) =>
      get<ConversationPage>(API_PATH.adminConversations, { feedback, q: text || undefined, offset, limit }),
    conversationStats: () => get<FeedbackStats>(API_PATH.adminConversationStats),
    conversation: (requestId: string) => get<ConversationDetail>(conversationPath(requestId)),
    deleteConversation: (requestId: string) =>
      guarded(requestVoid(conversationPath(requestId), { method: HTTP_METHOD.DELETE })),

    governanceSummary: (hours: number = DEFAULT_WINDOW_HOURS) =>
      get<GovernanceSummary>(API_PATH.governanceSummary, { hours }),
    governanceEvents: ({ outcome, limit = EVENTS_LIMIT }: EventsQuery = {}) =>
      get<AiEvent[]>(API_PATH.governanceEvents, { limit, outcome }),
    governancePolicy: () => get<GovernancePolicy>(API_PATH.governancePolicy),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
