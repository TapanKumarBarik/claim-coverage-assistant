import type { GovernanceSummary } from "../../../api/types";
import {
  CONFIDENCE_LABEL,
  GUARD_CODE_LABEL,
  INTENT_LABEL,
  MODEL_TIER_LABEL,
  OUTCOME_LABEL,
  TOOL_LABEL,
  VERDICT_LABEL,
} from "../../../constants/labels";
import type { MessageKey } from "../../../i18n/messages";
import { useI18n } from "../../../i18n/useI18n";
import { entriesByCount } from "../../../lib/objects";
import { useLabelFor } from "../../../shared/useLabelFor";
import { BarList } from "../../../ui/BarList";
import { EmptyState } from "../../../ui/EmptyState";
import "./governance.css";

type Counts = Readonly<Record<string, number>>;

/** One bar list: a title, where to read the counts from, and how to name each key. */
export interface Breakdown {
  title: MessageKey;
  counts: (summary: GovernanceSummary) => Counts;
  /** Localized labels for known enum keys; unknown keys (model names) are shown as sent. */
  labels?: Readonly<Record<string, MessageKey>>;
}

/** How requests turned out and what the verdicts were: the two lists that tell the story, shown at once. */
export const MAIN_BREAKDOWNS: readonly Breakdown[] = [
  { title: "gov.breakdown.outcomes", counts: (s) => s.by_outcome, labels: OUTCOME_LABEL },
  { title: "gov.breakdown.verdicts", counts: (s) => s.by_verdict, labels: VERDICT_LABEL },
];

/** The same traffic cut other ways, for when something in the main lists needs explaining. */
export const MORE_BREAKDOWNS: readonly Breakdown[] = [
  { title: "gov.breakdown.intents", counts: (s) => s.by_intent, labels: INTENT_LABEL },
  { title: "gov.breakdown.confidence", counts: (s) => s.by_confidence, labels: CONFIDENCE_LABEL },
  { title: "gov.breakdown.models", counts: (s) => s.by_model },
  { title: "gov.breakdown.tools", counts: (s) => s.tools, labels: TOOL_LABEL },
  { title: "gov.breakdown.guards", counts: (s) => s.guard_flags, labels: GUARD_CODE_LABEL },
  { title: "gov.breakdown.tokensByTier", counts: (s) => s.tokens.by_tier, labels: MODEL_TIER_LABEL },
];

const NO_LABELS: Readonly<Record<string, MessageKey>> = {};

function BreakdownCard({ breakdown, summary }: { breakdown: Breakdown; summary: GovernanceSummary }) {
  const { t, format } = useI18n();
  const labelFor = useLabelFor(breakdown.labels ?? NO_LABELS);
  const title = t(breakdown.title);
  const items = entriesByCount(breakdown.counts(summary))
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, label: breakdown.labels ? labelFor(key) : key, value: count }));

  return (
    <section className="breakdown">
      <h4>{title}</h4>
      {items.length === 0 ? <EmptyState>{t("common.noData")}</EmptyState> : <BarList items={items} label={title} formatValue={format.number} />}
    </section>
  );
}

/** Bar lists side by side, wrapping to fit the width. */
export function BreakdownGrid({ summary, breakdowns }: { summary: GovernanceSummary; breakdowns: readonly Breakdown[] }) {
  return (
    <div className="breakdown-grid">
      {breakdowns.map((breakdown) => (
        <BreakdownCard key={breakdown.title} breakdown={breakdown} summary={summary} />
      ))}
    </div>
  );
}
