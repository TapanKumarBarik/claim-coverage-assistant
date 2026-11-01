import { useState } from "react";
import { DEFAULT_WINDOW_HOURS } from "../../../constants/limits";
import { useI18n } from "../../../i18n/useI18n";
import { Tabs, type TabItem } from "../../../ui/Tabs";
import { EventsTable } from "./EventsTable";
import { OverviewTab } from "./OverviewTab";
import { PolicyPanel } from "./policy/PolicyPanel";
import { GOVERNANCE_TAB, GOVERNANCE_TABS, GOVERNANCE_TAB_LABEL, type GovernanceTab } from "./tabs";
import { WindowSelect } from "./WindowSelect";

/**
 * The "AI governance" tab, in three parts: is it healthy (Overview), what happened to each request (Requests),
 * and which rules the AI runs under (Rules). Each part loads only when it is opened.
 */
export function GovernancePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<GovernanceTab>(GOVERNANCE_TAB.OVERVIEW);
  const [hours, setHours] = useState(DEFAULT_WINDOW_HOURS);
  const tabs: TabItem<GovernanceTab>[] = GOVERNANCE_TABS.map((id) => ({ id, label: t(GOVERNANCE_TAB_LABEL[id]) }));

  return (
    <Tabs
      variant="secondary"
      label={t("gov.tabs.label")}
      tabs={tabs}
      value={tab}
      onChange={setTab}
      // The time window only shapes the overview, so it is only offered there.
      actions={tab === GOVERNANCE_TAB.OVERVIEW ? <WindowSelect hours={hours} onChange={setHours} /> : undefined}
    >
      {tab === GOVERNANCE_TAB.OVERVIEW && <OverviewTab hours={hours} />}
      {tab === GOVERNANCE_TAB.REQUESTS && <EventsTable />}
      {tab === GOVERNANCE_TAB.RULES && <PolicyPanel />}
    </Tabs>
  );
}
