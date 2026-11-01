import type { GovernanceSummary } from "../../../api/types";
import { BREAKER_STATE, OUTCOME } from "../../../constants/domain";
import { HEALTH_ISSUE, HEALTH_LEVEL, HEALTH_UNIT, type HealthIssueCode, type HealthLevel, type HealthUnit } from "../../../constants/health";
import { HEALTH_BUDGET_WARN_RATIO, HEALTH_CITATION_FLOOR } from "../../../constants/limits";
import { countOf } from "../../../lib/objects";

export interface HealthIssue {
  code: HealthIssueCode;
  level: typeof HEALTH_LEVEL.WARNING | typeof HEALTH_LEVEL.CRITICAL;
  /** The number the message quotes, and how to print it. */
  value: number;
  unit: HealthUnit;
}

export interface Health {
  level: HealthLevel;
  /** Most serious first. Empty when everything is normal. */
  issues: HealthIssue[];
}

const SEVERITY: Record<HealthLevel, number> = { ok: 0, warning: 1, critical: 2 };

/** Share of the global token budget already used; a missing budget counts as unused. */
export function budgetRatio(budgets: GovernanceSummary["budgets"]): number {
  return budgets.global_limit > 0 ? budgets.global_used / budgets.global_limit : 0;
}

/** How worrying a budget share is: nothing below the warning ratio, critical once it is all used. */
export function budgetLevel(ratio: number): HealthLevel {
  if (ratio >= 1) return HEALTH_LEVEL.CRITICAL;
  return ratio >= HEALTH_BUDGET_WARN_RATIO ? HEALTH_LEVEL.WARNING : HEALTH_LEVEL.OK;
}

/** Reads the figures of one time window and says whether anything needs an administrator's attention. */
export function deriveHealth(summary: GovernanceSummary): Health {
  const issues: HealthIssue[] = [];

  const errors = countOf(summary.by_outcome, OUTCOME.ERROR);
  if (errors > 0) issues.push({ code: HEALTH_ISSUE.ERRORS, level: HEALTH_LEVEL.WARNING, value: errors, unit: HEALTH_UNIT.COUNT });

  const { breaker } = summary;
  const failures = breaker.consecutive_failures;
  if (breaker.state === BREAKER_STATE.OPEN) {
    issues.push({ code: HEALTH_ISSUE.BREAKER_OPEN, level: HEALTH_LEVEL.CRITICAL, value: failures, unit: HEALTH_UNIT.COUNT });
  } else if (breaker.state === BREAKER_STATE.HALF_OPEN) {
    issues.push({ code: HEALTH_ISSUE.BREAKER_HALF_OPEN, level: HEALTH_LEVEL.WARNING, value: failures, unit: HEALTH_UNIT.COUNT });
  }

  const lockedOut = summary.abuse.locked_out_clients_now;
  if (lockedOut > 0) issues.push({ code: HEALTH_ISSUE.LOCKED_OUT, level: HEALTH_LEVEL.WARNING, value: lockedOut, unit: HEALTH_UNIT.COUNT });

  const used = budgetRatio(summary.budgets);
  const budget = budgetLevel(used);
  if (budget !== HEALTH_LEVEL.OK) issues.push({ code: HEALTH_ISSUE.BUDGET, level: budget, value: used, unit: HEALTH_UNIT.RATIO });

  const { citations } = summary;
  // With no quoted clauses at all there is no rate to judge.
  if (citations.verified + citations.dropped > 0 && citations.verify_rate < HEALTH_CITATION_FLOOR) {
    issues.push({ code: HEALTH_ISSUE.CITATIONS, level: HEALTH_LEVEL.WARNING, value: citations.verify_rate, unit: HEALTH_UNIT.RATIO });
  }

  issues.sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
  return { level: issues[0]?.level ?? HEALTH_LEVEL.OK, issues };
}
