import type { GovernanceSummary } from "../../../api/types";
import { EM_DASH } from "../../../constants/glyphs";
import { OUTCOME } from "../../../constants/domain";
import { useI18n } from "../../../i18n/useI18n";
import { countOf } from "../../../lib/objects";
import { Stat, StatGrid } from "../../../ui/Stat";

/** The four numbers worth seeing first for the selected time window. */
export function KpiGrid({ summary }: { summary: GovernanceSummary }) {
  const { t, format } = useI18n();
  const { latency, citations, abuse } = summary;
  const outcomeCount = (outcome: string) => format.number(countOf(summary.by_outcome, outcome));
  // With no citations at all, a "rate" would be meaningless.
  const citationRate = citations.verified + citations.dropped === 0 ? EM_DASH : format.percent(citations.verify_rate);

  return (
    <StatGrid>
      <Stat
        label={t("gov.kpi.requests")}
        value={format.number(summary.requests)}
        hint={t("gov.kpi.requestsHint", { answered: outcomeCount(OUTCOME.ANSWERED), replied: outcomeCount(OUTCOME.REPLIED) })}
      />
      <Stat
        label={t("gov.kpi.blocked")}
        value={outcomeCount(OUTCOME.BLOCKED)}
        hint={t("gov.kpi.blockedHint", { n: format.number(abuse.rate_limited) })}
      />
      <Stat
        label={t("gov.kpi.citations")}
        value={citationRate}
        hint={t("gov.kpi.citationsHint", { verified: format.number(citations.verified), dropped: format.number(citations.dropped) })}
      />
      <Stat
        label={t("gov.kpi.p95Latency")}
        value={format.duration(latency.p95_ms)}
        hint={t("gov.kpi.latencyHint", { average: format.duration(latency.average_ms) })}
      />
    </StatGrid>
  );
}
