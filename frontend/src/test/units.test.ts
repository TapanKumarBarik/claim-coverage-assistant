import { parseRoute, ROUTE } from "../app/routes";
import { enumOf, isOneOf } from "../constants/enumOf";
import { ERROR_CODES, OUTCOMES } from "../constants/domain";
import { MS_PER_MINUTE } from "../constants/limits";
import { minutesUntil, todayIso } from "../lib/dates";
import { entriesByCount } from "../lib/objects";
import { toCredentialsInput, validateCredentials, EMPTY_CREDENTIALS, type CredentialsFormValues } from "../features/settings/validation";
import { API_PATH, versionActivatePath, withQuery } from "../api/paths";

describe("routes", () => {
  it.each([
    ["", ROUTE.ASSISTANT],
    ["#/", ROUTE.ASSISTANT],
    ["#/settings", ROUTE.SETTINGS],
    ["#/admin", ROUTE.ADMIN],
    ["#/admin/anything", ROUTE.ADMIN],
    ["#/nowhere", ROUTE.ASSISTANT],
  ])("%j goes to %s", (hash, route) => {
    expect(parseRoute(hash)).toBe(route);
  });
});

describe("paths", () => {
  it("encodes ids with special characters", () => {
    expect(versionActivatePath("doc@2")).toBe("/api/admin/versions/doc%402/activate");
  });

  it("builds query strings and skips undefined values", () => {
    expect(withQuery(API_PATH.governanceEvents, { limit: 100, outcome: undefined })).toBe("/api/admin/governance/events?limit=100");
    expect(withQuery(API_PATH.governanceEvents, { limit: 5, outcome: "blocked" })).toBe("/api/admin/governance/events?limit=5&outcome=blocked");
    expect(withQuery(API_PATH.contracts)).toBe("/api/contracts");
  });
});

describe("enum constants", () => {
  it("lists every contract value, in contract order", () => {
    expect(OUTCOMES).toEqual(["answered", "replied", "blocked", "rate_limited", "locked_out", "budget_exhausted", "error"]);
    expect(ERROR_CODES).toHaveLength(16);
  });

  it("enumOf builds upper-case members and isOneOf narrows", () => {
    const COLOR = enumOf<"red" | "dark_blue">()(["red", "dark_blue"]);
    expect(COLOR).toEqual({ RED: "red", DARK_BLUE: "dark_blue" });
    expect(isOneOf(Object.values(COLOR), "red")).toBe(true);
    expect(isOneOf(Object.values(COLOR), "green")).toBe(false);
    expect(isOneOf(Object.values(COLOR), 3)).toBe(false);
  });

  it("enumOf refuses an incomplete list at compile time", () => {
    // @ts-expect-error "dark_blue" is missing
    enumOf<"red" | "dark_blue">()(["red"]);
  });
});

describe("dates", () => {
  it("formats today as YYYY-MM-DD in local time", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("rounds the time until a moment up to whole minutes, never below one", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    expect(minutesUntil("2026-10-29T12:30:00Z", now)).toBe(30);
    expect(minutesUntil(new Date(now + 29 * MS_PER_MINUTE + 1).toISOString(), now)).toBe(30);
    expect(minutesUntil("2026-10-29T11:00:00Z", now)).toBe(1);
    expect(minutesUntil(null, now)).toBeNull();
    expect(minutesUntil("not a date", now)).toBeNull();
  });
});

describe("objects", () => {
  it("sorts counts from the biggest down, ties alphabetically", () => {
    expect(entriesByCount({ b: 2, a: 2, c: 5 })).toEqual([["c", 5], ["a", 2], ["b", 2]]);
  });
});

describe("credentials validation", () => {
  const valid: CredentialsFormValues = {
    endpoint: "https://my-resource.openai.azure.com",
    apiKey: "sk-test-0123456789",
    reasoningDeployment: "gpt-5",
    fastDeployment: "",
    apiVersion: "",
  };

  it("accepts a good form", () => {
    expect(validateCredentials(valid)).toEqual({});
  });

  it.each([
    "https://my-resource.cognitiveservices.azure.com",
    "https://my-resource.services.ai.azure.com/",
    "https://MY-RESOURCE.OPENAI.AZURE.COM",
  ])("accepts the Azure endpoint %s", (endpoint) => {
    expect(validateCredentials({ ...valid, endpoint }).endpoint).toBeUndefined();
  });

  it.each([
    ["not a url"],
    ["http://my-resource.openai.azure.com"],
    ["https://openai.azure.com"],
    ["https://evil.example.com"],
    ["https://my-resource.openai.azure.com.evil.example.com"],
    [""],
  ])("rejects the endpoint %j", (endpoint) => {
    expect(validateCredentials({ ...valid, endpoint }).endpoint).toBeDefined();
  });

  it("checks the key length, the deployment names and the API version", () => {
    expect(validateCredentials({ ...valid, apiKey: "short" }).apiKey).toBeDefined();
    expect(validateCredentials({ ...valid, reasoningDeployment: "" }).reasoningDeployment?.key).toBe("settings.invalid.deploymentRequired");
    expect(validateCredentials({ ...valid, reasoningDeployment: "has space" }).reasoningDeployment?.key).toBe("settings.invalid.deployment");
    expect(validateCredentials({ ...valid, reasoningDeployment: "a".repeat(65) }).reasoningDeployment).toBeDefined();
    expect(validateCredentials({ ...valid, fastDeployment: "gpt-5.mini_1" }).fastDeployment).toBeUndefined();
    expect(validateCredentials({ ...valid, fastDeployment: "bad/name" }).fastDeployment).toBeDefined();
    expect(validateCredentials({ ...valid, apiVersion: "2025-04-01-preview" }).apiVersion).toBeUndefined();
    expect(validateCredentials({ ...valid, apiVersion: "v1" }).apiVersion).toBeUndefined();
    expect(validateCredentials({ ...valid, apiVersion: "latest" }).apiVersion).toBeDefined();
  });

  it("flags every field of an empty form that is required", () => {
    expect(Object.keys(validateCredentials(EMPTY_CREDENTIALS)).sort()).toEqual(["apiKey", "endpoint", "reasoningDeployment"]);
  });

  it("trims the body and drops blank optional fields", () => {
    expect(toCredentialsInput({ ...valid, endpoint: ` ${valid.endpoint} `, apiKey: "  sk-test-0123456789\n", fastDeployment: "  ", apiVersion: "" })).toEqual({
      endpoint: valid.endpoint,
      api_key: "sk-test-0123456789",
      reasoning_deployment: "gpt-5",
    });
  });
});
