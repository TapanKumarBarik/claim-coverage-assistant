import type { TierPolicy } from "../../../../api/types";
import { EM_DASH } from "../../../../constants/glyphs";
import { MODEL_TIER_LABEL, REASONING_EFFORT_LABEL } from "../../../../constants/labels";
import { useI18n } from "../../../../i18n/useI18n";
import { DataTable, type Column } from "../../../../ui/DataTable";

export function TierTable({ tiers }: { tiers: readonly TierPolicy[] }) {
  const { t, format } = useI18n();
  const columns: Column<TierPolicy>[] = [
    { key: "tier", header: t("gov.policy.tier"), cell: (row) => t(MODEL_TIER_LABEL[row.tier]) },
    {
      key: "deployment",
      header: t("gov.policy.deployment"),
      cell: (row) => (row.deployment ? <code>{row.deployment}</code> : <span className="muted">{t("gov.policy.deploymentNone")}</span>),
    },
    { key: "maxOutput", header: t("gov.policy.maxOutput"), numeric: true, cell: (row) => format.number(row.max_output_tokens) },
    { key: "timeout", header: t("gov.policy.timeout"), numeric: true, cell: (row) => format.seconds(row.timeout_s) },
    {
      key: "effort",
      header: t("gov.policy.effort"),
      cell: (row) => (row.reasoning_effort ? t(REASONING_EFFORT_LABEL[row.reasoning_effort]) : EM_DASH),
    },
  ];
  return <DataTable caption={t("gov.policy.tiers")} columns={columns} rows={tiers} rowKey={(row) => row.tier} />;
}
