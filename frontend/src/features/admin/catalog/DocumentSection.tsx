import type { DocumentAdmin } from "../../../api/types";
import { DOC_KIND_LABEL } from "../../../constants/labels";
import { TONE } from "../../../constants/tone";
import { DOC_KIND_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { EnumPill } from "../../../shared/EnumPill";
import { Alert } from "../../../ui/Alert";
import { EmptyState } from "../../../ui/EmptyState";
import { ListBlock } from "../../../ui/ListBlock";
import { ChangeSummary } from "./ChangeSummary";
import { ChunkPreview } from "./ChunkPreview";
import { useCatalog } from "./CatalogContext";
import { UploadForm } from "./UploadForm";
import { VersionConfirm } from "./VersionConfirm";
import { VersionTable } from "./VersionTable";
import "./catalog.css";

/** One document of a contract: its versions, the pending confirmation, the last upload, and the upload form. */
export function DocumentSection({ doc }: { doc: DocumentAdmin }) {
  const { t } = useI18n();
  const { pending, preview, uploaded, closePreview } = useCatalog();
  const owns = (versionId: string | undefined) => doc.versions.some((version) => version.id === versionId);

  return (
    <div className="document-section">
      <h4>
        {doc.title} <EnumPill value={doc.kind} tones={DOC_KIND_TONE} labels={DOC_KIND_LABEL} />
      </h4>

      {doc.versions.length === 0 ? <EmptyState>{t("admin.noVersions")}</EmptyState> : <VersionTable doc={doc} />}

      {owns(pending?.version.id) && <VersionConfirm />}

      {uploaded?.documentId === doc.id && (
        <Alert tone={TONE.OK} role="status">
          <p>{t("upload.created", { label: uploaded.version.label })}</p>
          <ChangeSummary version={uploaded.version} />
          <ListBlock title={t("upload.warnings")} items={uploaded.version.parse_warnings} compact />
        </Alert>
      )}

      {preview && owns(preview.version.id) && <ChunkPreview preview={preview} onClose={closePreview} />}

      <UploadForm documentId={doc.id} />
    </div>
  );
}
