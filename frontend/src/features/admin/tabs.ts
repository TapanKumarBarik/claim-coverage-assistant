import type { MessageKey } from "../../i18n/messages";

export const ADMIN_TAB = { CATALOG: "catalog", CONVERSATIONS: "conversations", GOVERNANCE: "governance", AUDIT: "audit" } as const;
export type AdminTab = (typeof ADMIN_TAB)[keyof typeof ADMIN_TAB];

export const ADMIN_TAB_LABEL: Record<AdminTab, MessageKey> = {
  catalog: "admin.tab.catalog",
  conversations: "admin.tab.conversations",
  governance: "admin.tab.governance",
  audit: "admin.tab.audit",
};

/** Display order of the tabs. */
export const ADMIN_TABS: readonly AdminTab[] = [ADMIN_TAB.CATALOG, ADMIN_TAB.CONVERSATIONS, ADMIN_TAB.GOVERNANCE, ADMIN_TAB.AUDIT];
