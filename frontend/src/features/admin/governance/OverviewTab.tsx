import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { Card } from "../../../ui/Card";
import { Disclosure } from "../../../ui/Disclosure";
import { useAdminApi } from "../adminContext";
import { BreakdownGrid, MAIN_BREAKDOWNS, MORE_BREAKDOWNS } from "./BreakdownPanel";
import { BudgetMeter } from "./BudgetMeter";
import { HealthBanner } from "./HealthBanner";
import { KpiGrid } from "./KpiGrid";

/** Is it healthy? One status line, four headline figures, the token budget and how requests turned out. */
export function OverviewTab({ hours }: { hours: number }) {
  const { t } = useI18n();
  const api = useAdminApi();
  const { state, reload } = useResource(() => api.governanceSummary(hours), [api, hours]);

  return (
    <AsyncView state={state} onRetry={reload}>
      {(summary) => (
        <div className="stack">
          <HealthBanner summary={summary} />
          <KpiGrid summary={summary} />
          <BudgetMeter summary={summary} />
          <Card title={t("gov.breakdown.title")}>
            <BreakdownGrid summary={summary} breakdowns={MAIN_BREAKDOWNS} />
            <Disclosure summary={t("gov.breakdown.more")}>
              <BreakdownGrid summary={summary} breakdowns={MORE_BREAKDOWNS} />
            </Disclosure>
          </Card>
        </div>
      )}
    </AsyncView>
  );
}
