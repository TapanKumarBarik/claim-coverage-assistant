// The status the AI governance overview gives a time window, and the reasons it can name. Computed in the browser from
// the summary (features/admin/governance/health.ts), so these are not part of the API contract.
import type { MessageKey } from "../i18n/messages";
import { TONE, type Tone } from "./tone";

export const HEALTH_LEVEL = { OK: "ok", WARNING: "warning", CRITICAL: "critical" } as const;
export type HealthLevel = (typeof HEALTH_LEVEL)[keyof typeof HEALTH_LEVEL];

export const HEALTH_ISSUE = {
  ERRORS: "errors",
  BREAKER_OPEN: "breaker_open",
  BREAKER_HALF_OPEN: "breaker_half_open",
  LOCKED_OUT: "locked_out",
  BUDGET: "budget",
  CITATIONS: "citations",
} as const;
export type HealthIssueCode = (typeof HEALTH_ISSUE)[keyof typeof HEALTH_ISSUE];

/** How the number in an issue is printed: a count, or a share between 0 and 1 shown as a percentage. */
export const HEALTH_UNIT = { COUNT: "count", RATIO: "ratio" } as const;
export type HealthUnit = (typeof HEALTH_UNIT)[keyof typeof HEALTH_UNIT];

export const HEALTH_LEVEL_LABEL: Record<HealthLevel, MessageKey> = {
  ok: "gov.health.ok",
  warning: "gov.health.warning",
  critical: "gov.health.critical",
};

export const HEALTH_LEVEL_TONE: Record<HealthLevel, Tone> = {
  ok: TONE.OK,
  warning: TONE.WARNING,
  critical: TONE.DANGER,
};

/** Each message has one `{value}` placeholder, filled with the issue's number. */
export const HEALTH_ISSUE_LABEL: Record<HealthIssueCode, MessageKey> = {
  errors: "gov.health.issue.errors",
  breaker_open: "gov.health.issue.breakerOpen",
  breaker_half_open: "gov.health.issue.breakerHalfOpen",
  locked_out: "gov.health.issue.lockedOut",
  budget: "gov.health.issue.budget",
  citations: "gov.health.issue.citations",
};
