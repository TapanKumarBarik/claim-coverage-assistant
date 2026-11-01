import type { LimitPolicy } from "../../../../api/types";
import { LIMIT_IS_SECONDS, LIMIT_LABEL } from "../../../../constants/labels";
import { useI18n } from "../../../../i18n/useI18n";
import { typedEntries } from "../../../../lib/objects";
import { DataTable, type Column } from "../../../../ui/DataTable";

type LimitRow = [keyof LimitPolicy, number];

export function LimitTable({ limits }: { limits: LimitPolicy }) {
  const { t, format } = useI18n();
  const rows: LimitRow[] = typedEntries(limits);
  const columns: Column<LimitRow>[] = [
    { key: "limit", header: t("gov.policy.limit"), cell: ([key]) => t(LIMIT_LABEL[key]) },
    {
      key: "value",
      header: t("gov.policy.value"),
      numeric: true,
      cell: ([key, value]) => (LIMIT_IS_SECONDS[key] ? format.seconds(value) : format.number(value)),
    },
  ];
  return <DataTable caption={t("gov.policy.limits")} columns={columns} rows={rows} rowKey={([key]) => key} />;
}
