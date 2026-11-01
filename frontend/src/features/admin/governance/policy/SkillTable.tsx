import type { SkillPolicy } from "../../../../api/types";
import { EM_DASH } from "../../../../constants/glyphs";
import { MODEL_TIER_LABEL, SKILL_LABEL, TOOL_LABEL } from "../../../../constants/labels";
import { useI18n } from "../../../../i18n/useI18n";
import { DataTable, type Column } from "../../../../ui/DataTable";

export function SkillTable({ skills }: { skills: readonly SkillPolicy[] }) {
  const { t } = useI18n();
  const columns: Column<SkillPolicy>[] = [
    { key: "name", header: t("gov.policy.skill"), cell: (row) => t(SKILL_LABEL[row.name]) },
    { key: "version", header: t("gov.policy.version"), cell: (row) => <code>{row.version}</code> },
    { key: "tier", header: t("gov.policy.tier"), cell: (row) => t(MODEL_TIER_LABEL[row.tier]) },
    { key: "tools", header: t("gov.policy.tools"), cell: (row) => row.tools.map((tool) => t(TOOL_LABEL[tool])).join(", ") || EM_DASH },
    { key: "maxSteps", header: t("gov.policy.maxSteps"), numeric: true, cell: (row) => row.max_steps },
  ];
  return <DataTable caption={t("gov.policy.skills")} columns={columns} rows={skills} rowKey={(row) => row.name} />;
}
