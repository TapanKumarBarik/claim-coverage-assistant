import type { AuditRecord } from "../../../api/types";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { DataTable, type Column } from "../../../ui/DataTable";
import { useAdminApi } from "../adminContext";
import { toAuditRow, type AuditRow } from "./auditRow";

/** The most recent catalogue changes: who did what, and when. */
export function AuditTable() {
  const { t, format } = useI18n();
  const api = useAdminApi();
  const { state, reload } = useResource(api.audit, [api]);

  const columns: Column<AuditRow>[] = [
    { key: "when", header: t("audit.when"), cell: (row) => format.dateTime(row.at) },
    { key: "who", header: t("audit.who"), cell: (row) => row.actor },
    { key: "what", header: t("audit.what"), cell: (row) => <code>{row.action}</code> },
    { key: "details", header: t("audit.details"), cell: (row) => <span className="muted">{row.details}</span> },
  ];

  return (
    <AsyncView
      state={state}
      onRetry={reload}
      isEmpty={(records) => records.length === 0}
      emptyLabel={t("audit.empty")}
    >
      {(records: AuditRecord[]) => (
        <DataTable caption={t("audit.title")} columns={columns} rows={records.map(toAuditRow)} rowKey={(row, index) => `${row.at}-${index}`} />
      )}
    </AsyncView>
  );
}
