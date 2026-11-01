import type { GovernanceSummary } from "../api/types";
import { HEALTH_ISSUE, HEALTH_LEVEL } from "../constants/health";
import { HEALTH_BUDGET_WARN_RATIO } from "../constants/limits";
import { budgetLevel, budgetRatio, deriveHealth } from "../features/admin/governance/health";
import { summary } from "./fixtures";

/** A window with nothing wrong, to change one thing at a time. */
const calm: GovernanceSummary = {
  ...summary,
  by_outcome: { answered: 90, replied: 20, blocked: 5 },
  abuse: { blocked_requests: 5, rate_limited: 0, locked_out_clients_now: 0 },
  breaker: { state: "closed", consecutive_failures: 0 },
  budgets: { global_used: 100, global_limit: 1000, client_limit: 50 },
  citations: { verified: 90, dropped: 10, verify_rate: 0.9 },
};

describe("deriveHealth", () => {
  it("is ok, with no issues, when nothing is wrong (blocked attacks are the guardrails working)", () => {
    expect(deriveHealth(calm)).toEqual({ level: HEALTH_LEVEL.OK, issues: [] });
  });

  it("flags errors, and quotes how many", () => {
    const health = deriveHealth({ ...calm, by_outcome: { ...calm.by_outcome, error: 3 } });
    expect(health.level).toBe(HEALTH_LEVEL.WARNING);
    expect(health.issues).toEqual([{ code: HEALTH_ISSUE.ERRORS, level: HEALTH_LEVEL.WARNING, value: 3, unit: "count" }]);
  });

  it("flags a half-open breaker as a warning and an open one as critical", () => {
    expect(deriveHealth({ ...calm, breaker: { state: "half_open", consecutive_failures: 5 } }).issues[0]).toMatchObject({
      code: HEALTH_ISSUE.BREAKER_HALF_OPEN,
      level: HEALTH_LEVEL.WARNING,
      value: 5,
    });
    expect(deriveHealth({ ...calm, breaker: { state: "open", consecutive_failures: 7 } })).toMatchObject({
      level: HEALTH_LEVEL.CRITICAL,
      issues: [{ code: HEALTH_ISSUE.BREAKER_OPEN, value: 7 }],
    });
  });

  it("flags clients that are locked out right now", () => {
    expect(deriveHealth({ ...calm, abuse: { ...calm.abuse, locked_out_clients_now: 2 } }).issues).toEqual([
      { code: HEALTH_ISSUE.LOCKED_OUT, level: HEALTH_LEVEL.WARNING, value: 2, unit: "count" },
    ]);
  });

  it("flags a citation rate below the floor only when there were citations to judge", () => {
    expect(deriveHealth({ ...calm, citations: { verified: 1, dropped: 9, verify_rate: 0.1 } }).issues).toEqual([
      { code: HEALTH_ISSUE.CITATIONS, level: HEALTH_LEVEL.WARNING, value: 0.1, unit: "ratio" },
    ]);
    expect(deriveHealth({ ...calm, citations: { verified: 0, dropped: 0, verify_rate: 0 } }).issues).toEqual([]);
  });

  it("puts the most serious issue first and takes the level from it", () => {
    const health = deriveHealth({
      ...calm,
      by_outcome: { ...calm.by_outcome, error: 1 },
      breaker: { state: "open", consecutive_failures: 5 },
    });
    expect(health.level).toBe(HEALTH_LEVEL.CRITICAL);
    expect(health.issues.map((issue) => issue.code)).toEqual([HEALTH_ISSUE.BREAKER_OPEN, HEALTH_ISSUE.ERRORS]);
  });
});

describe("the token budget", () => {
  it("measures the share used, and treats a missing limit as unused", () => {
    expect(budgetRatio({ global_used: 250, global_limit: 1000, client_limit: 1 })).toBe(0.25);
    expect(budgetRatio({ global_used: 250, global_limit: 0, client_limit: 1 })).toBe(0);
  });

  it("warns from the configured ratio and is critical once it is all used", () => {
    expect(budgetLevel(HEALTH_BUDGET_WARN_RATIO - 0.01)).toBe(HEALTH_LEVEL.OK);
    expect(budgetLevel(HEALTH_BUDGET_WARN_RATIO)).toBe(HEALTH_LEVEL.WARNING);
    expect(budgetLevel(0.999)).toBe(HEALTH_LEVEL.WARNING);
    expect(budgetLevel(1)).toBe(HEALTH_LEVEL.CRITICAL);
    expect(budgetLevel(1.4)).toBe(HEALTH_LEVEL.CRITICAL);
  });
});
