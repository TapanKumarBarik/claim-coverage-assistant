import { FETCH_CREDENTIALS, HEADER, HTTP_METHOD, MEDIA_TYPE, type HttpMethod } from "../constants/http";
import { NetworkError, parseApiError } from "./errors";
import { withQuery, type Query } from "./paths";

export interface RequestOptions {
  method?: HttpMethod;
  json?: unknown;
  form?: FormData;
  query?: Query;
}

function buildInit({ method = HTTP_METHOD.GET, json, form }: RequestOptions): RequestInit {
  const headers: Record<string, string> = {};
  if (json !== undefined) headers[HEADER.CONTENT_TYPE] = MEDIA_TYPE.JSON;
  // For FormData the browser sets the multipart Content-Type (with its boundary) itself.
  const body = json !== undefined ? JSON.stringify(json) : form;
  return { method, headers, body, credentials: FETCH_CREDENTIALS };
}

/** The single place that calls `fetch`. Throws `NetworkError` or `ApiError`, never a raw `Response`. */
async function send(path: string, options: RequestOptions): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(withQuery(path, options.query), buildInit(options));
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw parseApiError(response.status, body, response.headers.get(HEADER.RETRY_AFTER));
  }
  return response;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return response.json() as Promise<T>;
}

/** For endpoints that answer 204 No Content. */
export async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}
