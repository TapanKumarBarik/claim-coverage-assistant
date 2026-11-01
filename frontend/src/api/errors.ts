import { ERROR_CODE, ERROR_CODES } from "../constants/domain";
import { isOneOf } from "../constants/enumOf";
import type { ErrorCode } from "./types";

/** `fetch` itself failed: offline, DNS, CORS, server down. There is no HTTP response to read. */
export class NetworkError extends Error {
  constructor() {
    super("Network request failed");
    this.name = "NetworkError";
  }
}

export interface ApiErrorInit {
  status: number;
  /** `null` when the response had no recognisable `code` (a proxy error page, an old server). */
  code: ErrorCode | null;
  detail: string;
  requestId: string | null;
  /** Seconds from the `Retry-After` header. */
  retryAfter: number | null;
}

/** The server answered with an error body `{ code, detail, request_id }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly detail: string;
  readonly requestId: string | null;
  readonly retryAfter: number | null;

  constructor(init: ApiErrorInit) {
    super(init.detail || init.code || `HTTP ${init.status}`);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** FastAPI validation errors carry `detail` as a list of `{ msg, loc }`; ours carry a string. */
function readDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return "";
  return detail
    .map((item: unknown) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "msg" in item) return String((item as { msg: unknown }).msg);
      return "";
    })
    .filter(Boolean)
    .join("; ");
}

function readRetryAfter(header: string | null): number | null {
  const seconds = Number(header);
  return header !== null && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** Build an `ApiError` from whatever the server sent (the body may be null or not JSON at all). */
export function parseApiError(status: number, body: unknown, retryAfterHeader: string | null): ApiError {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const code = isOneOf(ERROR_CODES, record.code) ? record.code : null;
  return new ApiError({
    status,
    // A FastAPI validation response (`detail` as a list) has no `code`; it is invalid input by definition.
    code: code ?? (Array.isArray(record.detail) ? ERROR_CODE.INVALID_INPUT : null),
    detail: readDetail(record.detail),
    requestId: typeof record.request_id === "string" ? record.request_id : null,
    retryAfter: readRetryAfter(retryAfterHeader),
  });
}
