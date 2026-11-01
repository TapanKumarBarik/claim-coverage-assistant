import type { ContractPublic } from "../../api/types";
import { MIDDLE_DOT } from "../../constants/glyphs";
import { DOC_KIND_LABEL, DOC_KIND_TIP } from "../../constants/labels";
import { DOC_KIND_TONE } from "../../constants/tones";
import { useI18n } from "../../i18n/useI18n";
import { EnumPill } from "../../shared/EnumPill";

/** The documents on file for the chosen contract, each with its kind and the version currently in force. */
export function DocumentList({ contract }: { contract: ContractPublic }) {
  const { t, format } = useI18n();
  return (
    <ul className="document-list">
      {contract.documents.map((doc) => (
        <li key={doc.id}>
          <EnumPill value={doc.kind} tones={DOC_KIND_TONE} labels={DOC_KIND_LABEL} title={t(DOC_KIND_TIP[doc.kind])} />{" "}
          {doc.source_url ? (
            <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
              {doc.title}
            </a>
          ) : (
            doc.title
          )}
          {doc.current && (
            <span className="muted">{` ${MIDDLE_DOT} ${doc.current.label}, ${format.date(doc.current.effective_from)}`}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
