import { useMemo, useState, type ComponentType } from "react";
import { useI18n } from "../../i18n/useI18n";
import { Button } from "../../ui/Button";
import { Tabs, type TabItem } from "../../ui/Tabs";
import { AdminNavigationContext, type AdminNavigation } from "./adminNavigation";
import { AuditTable } from "./audit/AuditTable";
import { CatalogTab } from "./catalog/CatalogTab";
import { ConversationsTab } from "./conversations/ConversationsTab";
import { GovernancePage } from "./governance/GovernancePage";
import { ADMIN_TAB, ADMIN_TABS, ADMIN_TAB_LABEL, type AdminTab } from "./tabs";
import { UsageLine } from "./UsageLine";

const TAB_CONTENT: Record<AdminTab, ComponentType> = {
  catalog: CatalogTab,
  conversations: ConversationsTab,
  governance: GovernancePage,
  audit: AuditTable,
};

/** The signed-in admin area: four tabs, the token budget and a sign-out button. */
export function AdminWorkspace({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<AdminTab>(ADMIN_TAB.CATALOG);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const tabs: TabItem<AdminTab>[] = ADMIN_TABS.map((id) => ({ id, label: t(ADMIN_TAB_LABEL[id]) }));
  const Content = TAB_CONTENT[tab];

  const navigation = useMemo<AdminNavigation>(
    () => ({
      conversationId,
      openConversation: (requestId) => {
        setConversationId(requestId);
        setTab(ADMIN_TAB.CONVERSATIONS);
      },
      closeConversation: () => setConversationId(null),
    }),
    [conversationId],
  );

  function selectTab(next: AdminTab) {
    // Choosing a tab by hand always starts at its top level, never at a conversation opened from elsewhere.
    setConversationId(null);
    setTab(next);
  }

  return (
    <AdminNavigationContext.Provider value={navigation}>
      <Tabs
        label={t("admin.title")}
        tabs={tabs}
        value={tab}
        onChange={selectTab}
        actions={
          <>
            <UsageLine />
            <Button variant="link" onClick={onSignOut}>
              {t("admin.logout")}
            </Button>
          </>
        }
      >
        <Content />
      </Tabs>
    </AdminNavigationContext.Provider>
  );
}
