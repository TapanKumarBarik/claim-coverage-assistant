import { HTTP_METHOD } from "../constants/http";
import { request, requestVoid } from "./client";
import { API_PATH } from "./paths";
import type { CredentialsInput, SessionStatus } from "./types";

/**
 * Bring-your-own Azure OpenAI credentials. The server keeps the key in memory behind an HttpOnly cookie;
 * the key travels in exactly one request body (`save`) and is never read back.
 */
export const sessionApi = {
  status: () => request<SessionStatus>(API_PATH.session),
  save: (input: CredentialsInput) =>
    request<SessionStatus>(API_PATH.sessionCredentials, { method: HTTP_METHOD.PUT, json: input }),
  forget: () => requestVoid(API_PATH.sessionCredentials, { method: HTTP_METHOD.DELETE }),
};
