import type { MessageKey } from "../../../i18n/messages";

export const GOVERNANCE_TAB = { OVERVIEW: "overview", REQUESTS: "requests", RULES: "rules" } as const;
export type GovernanceTab = (typeof GOVERNANCE_TAB)[keyof typeof GOVERNANCE_TAB];

export const GOVERNANCE_TAB_LABEL: Record<GovernanceTab, MessageKey> = {
  overview: "gov.tab.overview",
  requests: "gov.tab.requests",
  rules: "gov.tab.rules",
};

/** Display order of the tabs. */
export const GOVERNANCE_TABS: readonly GovernanceTab[] = [GOVERNANCE_TAB.OVERVIEW, GOVERNANCE_TAB.REQUESTS, GOVERNANCE_TAB.RULES];
