export const HTTP_METHOD = { GET: "GET", POST: "POST", PUT: "PUT", DELETE: "DELETE" } as const;
export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

export const HEADER = {
  CONTENT_TYPE: "Content-Type",
  RETRY_AFTER: "Retry-After",
} as const;

export const MEDIA_TYPE = { JSON: "application/json" } as const;

/** The session cookies (visitor and admin) are HttpOnly and same-origin: `fetch` sends them, scripts never see them. */
export const FETCH_CREDENTIALS: RequestCredentials = "same-origin";
