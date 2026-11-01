import type { MessageKey } from "../i18n/messages";

export const ROUTE = { ASSISTANT: "assistant", SETTINGS: "settings", ADMIN: "admin" } as const;
export type Route = (typeof ROUTE)[keyof typeof ROUTE];

export const DEFAULT_ROUTE: Route = ROUTE.ASSISTANT;

/** Hash-based routing: the whole app is one static page. */
export const ROUTE_HASH: Record<Route, string> = {
  [ROUTE.ASSISTANT]: "#/",
  [ROUTE.SETTINGS]: "#/settings",
  [ROUTE.ADMIN]: "#/admin",
};

/** Main navigation, in display order. */
export const NAV_ITEMS: ReadonlyArray<{ route: Route; labelKey: MessageKey }> = [
  { route: ROUTE.ASSISTANT, labelKey: "nav.assistant" },
  { route: ROUTE.SETTINGS, labelKey: "nav.settings" },
  { route: ROUTE.ADMIN, labelKey: "nav.admin" },
];

/** Which page a URL hash points at. Unknown hashes fall back to the assistant. */
export function parseRoute(hash: string): Route {
  const match = Object.values(ROUTE).find((route) => route !== DEFAULT_ROUTE && hash.startsWith(ROUTE_HASH[route]));
  return match ?? DEFAULT_ROUTE;
}
