import { ApiError, NetworkError, parseApiError } from "../api/errors";
import { publicApi } from "../api/public";
import type { ErrorCode } from "../api/types";
import { ERROR_CODE, ERROR_CODES } from "../constants/domain";
import { createTranslator } from "../i18n/translate";
import { describeError } from "../shared/describeError";
import { errorResponse, jsonResponse, mockApi, routeKey } from "./harness";
import { API_PATH } from "../api/paths";
import { HTTP_METHOD } from "../constants/http";

const en = createTranslator("en");
const fr = createTranslator("fr");
const SERVER_TEXT = "Stack trace: secret server wording";

const apiError = (code: ErrorCode | null, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({ status: 500, code, detail: "", requestId: null, retryAfter: null, ...extra });

describe("describeError: every API error code has a localized message", () => {
  it.each(ERROR_CODES)("%s", (code) => {
    const english = describeError(en, apiError(code));
    const french = describeError(fr, apiError(code));
    for (const message of [english, french]) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/[{}]/); // no unfilled placeholder
    }
    expect(french).not.toBe(english);
  });

  it("never shows server text for a code it knows (except validation details)", () => {
    for (const code of ERROR_CODES.filter((candidate) => candidate !== ERROR_CODE.INVALID_INPUT)) {
      expect(describeError(en, apiError(code, { detail: SERVER_TEXT }))).not.toContain(SERVER_TEXT);
      expect(describeError(fr, apiError(code, { detail: SERVER_TEXT }))).not.toContain(SERVER_TEXT);
    }
  });

  it("tells a blocked message to be rephrased in plain words, without echoing the server", () => {
    const error = apiError(ERROR_CODE.GUARDRAIL_BLOCKED, { detail: SERVER_TEXT });
    expect(describeError(en, error)).toBe("This message can't be processed. Please describe your claim in plain words.");
    expect(describeError(fr, error)).toMatch(/ne peut pas être traité/);
  });

  it.each([ERROR_CODE.RATE_LIMITED, ERROR_CODE.LOCKED_OUT])("%s says how many seconds to wait when Retry-After is known", (code) => {
    expect(describeError(en, apiError(code, { retryAfter: 12 }))).toContain("12 seconds");
    expect(describeError(fr, apiError(code, { retryAfter: 12 }))).toContain("12 secondes");
    expect(describeError(en, apiError(code))).not.toMatch(/\d+ seconds/);
  });

  it("shows validation details, which say which field is wrong", () => {
    const error = apiError(ERROR_CODE.INVALID_INPUT, { detail: "claim: too long" });
    expect(describeError(en, error)).toContain("claim: too long");
    expect(describeError(fr, error)).toContain("claim: too long");
  });

  it("treats a network failure as its own case", () => {
    expect(describeError(en, new NetworkError())).toMatch(/cannot reach the server/i);
    expect(describeError(fr, new NetworkError())).toMatch(/impossible de joindre le serveur/i);
  });

  it("falls back to the server's detail when the response had no known code", () => {
    expect(describeError(en, apiError(null, { detail: "Upstream said no" }))).toContain("Upstream said no");
    expect(describeError(en, apiError(null))).toBe("Something went wrong. Please try again.");
    expect(describeError(en, new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});

describe("parseApiError", () => {
  it("reads the contract's error body", () => {
    const error = parseApiError(429, { code: "rate_limited", detail: "Slow down", request_id: "req-1" }, "7");
    expect(error).toMatchObject({ status: 429, code: "rate_limited", detail: "Slow down", requestId: "req-1", retryAfter: 7 });
  });

  it("treats FastAPI's validation list as invalid input and joins the messages", () => {
    const error = parseApiError(
      422,
      { detail: [{ loc: ["body", "claim"], msg: "String should have at least 1 character", type: "string_too_short" }, { msg: "Field required" }] },
      null,
    );
    expect(error.code).toBe(ERROR_CODE.INVALID_INPUT);
    expect(error.detail).toBe("String should have at least 1 character; Field required");
  });

  it("ignores a code it does not know, and a Retry-After that is not a positive number", () => {
    const error = parseApiError(500, { code: "something_new", detail: "x" }, "soon");
    expect(error.code).toBeNull();
    expect(error.retryAfter).toBeNull();
  });

  it("copes with a body that is not JSON", () => {
    expect(parseApiError(502, null, null)).toMatchObject({ code: null, detail: "", requestId: null });
  });
});

describe("request (through the public API)", () => {
  it("turns a failed fetch into a NetworkError", async () => {
    mockApi({});
    await expect(publicApi.contracts()).rejects.toBeInstanceOf(NetworkError);
  });

  it("carries code, request id and Retry-After from the response", async () => {
    mockApi({ [routeKey(HTTP_METHOD.GET, API_PATH.contracts)]: () => errorResponse(ERROR_CODE.RATE_LIMITED, 429, { requestId: "req-9", headers: { "Retry-After": "12" } }) });
    await expect(publicApi.contracts()).rejects.toMatchObject({ code: "rate_limited", requestId: "req-9", retryAfter: 12 });
  });

  it("returns the parsed body on success", async () => {
    mockApi({ [routeKey(HTTP_METHOD.GET, API_PATH.examples)]: () => jsonResponse([]) });
    await expect(publicApi.examples()).resolves.toEqual([]);
  });
});
