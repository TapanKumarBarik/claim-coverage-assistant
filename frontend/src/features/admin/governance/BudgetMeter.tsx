import type { GovernanceSummary } from "../../../api/types";
import { HEALTH_LEVEL_TONE } from "../../../constants/health";
import { useI18n } from "../../../i18n/useI18n";
import { Meter } from "../../../ui/Meter";
import { budgetLevel, budgetRatio } from "./health";

/** How much of the global token budget is used, with what the selected period spent. */
export function BudgetMeter({ summary }: { summary: GovernanceSummary }) {
  const { t, format } = useI18n();
  const { budgets, tokens } = summary;
  const ratio = budgetRatio(budgets);
  const used = format.number(budgets.global_used);
  const limit = format.number(budgets.global_limit);

  return (
    <Meter
      label={t("gov.kpi.budget")}
      value={budgets.global_used}
      max={budgets.global_limit}
      tone={HEALTH_LEVEL_TONE[budgetLevel(ratio)]}
      valueText={`${t("gov.kpi.budgetValue", { used, limit })} (${format.percent(ratio)})`}
      hint={t("gov.budget.period", {
        total: format.number(tokens.prompt + tokens.completion),
        prompt: format.number(tokens.prompt),
        completion: format.number(tokens.completion),
      })}
    />
  );
}
