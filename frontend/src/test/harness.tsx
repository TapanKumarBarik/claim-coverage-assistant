import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";
import App from "../app/App";
import { AppProviders } from "../app/AppProviders";
import { ROUTE_HASH, type Route } from "../app/routes";
import { API_PATH } from "../api/paths";
import type { ErrorCode, Language, SessionStatus } from "../api/types";
import { HEADER, HTTP_METHOD, MEDIA_TYPE, type HttpMethod } from "../constants/http";
import { LANGUAGE } from "../constants/domain";
import { STORAGE_KEY } from "../constants/storage";
import { contracts, examples, serverSession } from "./fixtures";

export const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { [HEADER.CONTENT_TYPE]: MEDIA_TYPE.JSON, ...headers },
  });

/** An error response in the contract's shape: `{ code, detail, request_id }`. */
export const errorResponse = (
  code: ErrorCode,
  status: number,
  { detail = "Server detail that must not be echoed.", requestId = "req-err", headers = {} }: { detail?: string; requestId?: string; headers?: Record<string, string> } = {},
): Response => jsonResponse({ code, detail, request_id: requestId }, status, headers);

export interface Call {
  url: URL;
  init: RequestInit;
  /** Parsed JSON body, or the `FormData` for uploads. */
  body: unknown;
}

export type Handler = (call: Call) => Response | Promise<Response>;
export type Routes = Record<string, Handler>;

export const routeKey = (method: HttpMethod, path: string) => `${method} ${path}`;

/** The endpoints every page loads. Tests override only what they care about. */
export function defaultRoutes(session: SessionStatus = serverSession): Routes {
  return {
    [routeKey(HTTP_METHOD.GET, API_PATH.session)]: () => jsonResponse(session),
    [routeKey(HTTP_METHOD.GET, API_PATH.contracts)]: () => jsonResponse(contracts),
    [routeKey(HTTP_METHOD.GET, API_PATH.examples)]: () => jsonResponse(examples),
  };
}

/** Replace `fetch` with a router. A request nobody handles fails like a network error. */
export function mockApi(routes: Routes): Mock {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const handler = routes[routeKey((init.method ?? HTTP_METHOD.GET) as HttpMethod, url.pathname)];
    if (!handler) throw new TypeError(`Unmocked request: ${init.method ?? "GET"} ${url.pathname}`);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : init.body;
    return handler({ url, init, body });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Every recorded call to `method path`, parsed. */
export function callsTo(fetchMock: Mock, method: HttpMethod, path: string): Call[] {
  return fetchMock.mock.calls
    .map((args) => ({ url: new URL(String(args[0]), "http://localhost"), init: (args[1] ?? {}) as RequestInit }))
    .filter(({ url, init }) => url.pathname === path && (init.method ?? HTTP_METHOD.GET) === method)
    .map(({ url, init }) => ({ url, init, body: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : init.body }));
}

export function renderApp({ route, language }: { route?: Route; language?: Language } = {}) {
  if (route) window.location.hash = ROUTE_HASH[route];
  if (language) localStorage.setItem(STORAGE_KEY.LANGUAGE, language);
  const user = userEvent.setup();
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
  return user;
}

export const ENGLISH = LANGUAGE.EN;
export const FRENCH = LANGUAGE.FR;
