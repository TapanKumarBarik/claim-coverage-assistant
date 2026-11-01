import { API_PATH, conversationPath } from "../api/paths";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { catalog, conversationDetail, conversationPage, events, feedbackStats, policy, summary } from "./fixtures";
import { defaultRoutes, errorResponse, jsonResponse, mockApi, routeKey, type Handler, type Routes } from "./harness";

export const ADMIN_PASSWORD = "good-password";

/**
 * The server's side of the admin cookie: is this "browser" signed in? Scripts cannot see the real cookie, so the
 * mocked API keeps the answer here. `mockAdminApi` starts every test signed out.
 */
export const adminSession = {
  signedIn: false,
  signIn() {
    this.signedIn = true;
  },
  /** The server forgets the session, as it does when it is idle too long. */
  expire() {
    this.signedIn = false;
  },
};

const refused = () => errorResponse(ERROR_CODE.UNAUTHORIZED, 401, { detail: "Invalid or missing admin credentials." });

/** Only answers while the session is signed in; otherwise the contract's `unauthorized` error. */
export const asAdmin =
  (handler: Handler): Handler =>
  (call) =>
    adminSession.signedIn ? handler(call) : refused();

export const adminRoute = (path: string, handler: Handler): Routes => ({ [routeKey(HTTP_METHOD.GET, path)]: asAdmin(handler) });

const SESSION_BODY = { expires_at: "2026-10-29T20:00:00Z" };

/** The admin endpoints with realistic data. Pass `extra` to add or override routes. */
export function mockAdminApi(extra: Routes = {}) {
  adminSession.expire();
  return mockApi({
    ...defaultRoutes(),
    [routeKey(HTTP_METHOD.GET, API_PATH.adminSession)]: () => (adminSession.signedIn ? jsonResponse(SESSION_BODY) : refused()),
    [routeKey(HTTP_METHOD.POST, API_PATH.adminSession)]: ({ body }) => {
      if ((body as { password?: string } | undefined)?.password !== ADMIN_PASSWORD) return refused();
      adminSession.signIn();
      return jsonResponse(SESSION_BODY);
    },
    [routeKey(HTTP_METHOD.DELETE, API_PATH.adminSession)]: () => {
      adminSession.expire();
      return jsonResponse(null, 204);
    },
    ...adminRoute(API_PATH.adminCatalog, () => jsonResponse(catalog)),
    ...adminRoute(API_PATH.adminAudit, () =>
      jsonResponse([
        { at: "2026-10-20T10:00:00Z", actor: "admin", action: "version.activate", version_id: "demo-habitat-confort-cg@1" },
      ]),
    ),
    ...adminRoute(API_PATH.adminConversations, () => jsonResponse(conversationPage)),
    ...adminRoute(API_PATH.adminConversationStats, () => jsonResponse(feedbackStats)),
    ...adminRoute(conversationPath(conversationPage.items[0]!.request_id), () => jsonResponse(conversationDetail())),
    ...adminRoute(API_PATH.governanceSummary, () => jsonResponse(summary)),
    ...adminRoute(API_PATH.governanceEvents, () => jsonResponse(events)),
    ...adminRoute(API_PATH.governancePolicy, () => jsonResponse(policy)),
    ...extra,
  });
}
