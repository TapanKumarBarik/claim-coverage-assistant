import type { DocumentUsed } from "../../../api/types";
import { EM_DASH } from "../../../constants/glyphs";
import { useI18n } from "../../../i18n/useI18n";
import { Disclosure } from "../../../ui/Disclosure";

export function DocumentsUsed({ documents }: { documents: readonly DocumentUsed[] }) {
  const { t, format } = useI18n();
  return (
    <Disclosure summary={t("docsUsed.title")} className="assessment__block">
      <ul>
        {documents.map((doc) => (
          <li key={doc.version_id}>
            <strong>{doc.title}</strong> {EM_DASH}{" "}
            {t("docsUsed.effective", { label: doc.version_label, date: format.date(doc.effective_from) })}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
