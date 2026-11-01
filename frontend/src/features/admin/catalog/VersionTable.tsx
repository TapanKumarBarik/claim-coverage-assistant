import type { DocumentAdmin, DocumentVersion } from "../../../api/types";
import { VERSION_STATUS_LABEL } from "../../../constants/labels";
import { VERSION_STATUS_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { EnumPill } from "../../../shared/EnumPill";
import { DataTable, type Column } from "../../../ui/DataTable";
import { VersionActions } from "./VersionActions";

/** Versions of one document, newest effective date first. */
export function VersionTable({ doc }: { doc: DocumentAdmin }) {
  const { t, format } = useI18n();
  const rows = [...doc.versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  const columns: Column<DocumentVersion>[] = [
    {
      key: "version",
      header: t("admin.col.version"),
      cell: (v) => (
        <>
          <strong>{v.label}</strong>
          <br />
          <code className="muted">{v.id}</code>
        </>
      ),
    },
    { key: "effective", header: t("admin.col.effective"), cell: (v) => format.date(v.effective_from) },
    {
      key: "status",
      header: t("admin.col.status"),
      cell: (v) => <EnumPill value={v.status} tones={VERSION_STATUS_TONE} labels={VERSION_STATUS_LABEL} />,
    },
    { key: "size", header: t("admin.col.size"), cell: (v) => `${v.pages} / ${v.n_chunks}` },
    {
      key: "search",
      header: t("admin.col.search"),
      cell: (v) => (v.has_embeddings ? t("admin.search.hybrid") : t("admin.search.keyword")),
    },
    { key: "actions", header: t("admin.col.actions"), cell: (v) => <VersionActions version={v} /> },
  ];

  return <DataTable caption={t("admin.versionsOf", { title: doc.title })} columns={columns} rows={rows} rowKey={(v) => v.id} />;
}
