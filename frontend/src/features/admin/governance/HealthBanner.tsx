import type { GovernanceSummary } from "../../../api/types";
import { HEALTH_ISSUE_LABEL, HEALTH_LEVEL_LABEL, HEALTH_LEVEL_TONE, HEALTH_UNIT } from "../../../constants/health";
import { useI18n } from "../../../i18n/useI18n";
import { Alert } from "../../../ui/Alert";
import { budgetRatio, deriveHealth } from "./health";
import "./governance.css";

/** The answer to "is everything fine?": a status, and either the reasons it is not or a one-line summary. */
export function HealthBanner({ summary }: { summary: GovernanceSummary }) {
  const { t, format } = useI18n();
  const health = deriveHealth(summary);

  return (
    <Alert tone={HEALTH_LEVEL_TONE[health.level]} title={t(HEALTH_LEVEL_LABEL[health.level])}>
      {health.issues.length === 0 ? (
        <p>{t("gov.health.okDetail", { requests: format.number(summary.requests), budget: format.percent(budgetRatio(summary.budgets)) })}</p>
      ) : (
        <ul className="health-issues">
          {health.issues.map((issue) => (
            <li key={issue.code}>
              {t(HEALTH_ISSUE_LABEL[issue.code], { value: issue.unit === HEALTH_UNIT.RATIO ? format.percent(issue.value) : format.number(issue.value) })}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
