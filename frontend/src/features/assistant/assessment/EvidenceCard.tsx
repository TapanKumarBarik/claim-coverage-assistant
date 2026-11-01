import { useId, useState } from "react";
import type { EvidenceItem } from "../../../api/types";
import { MIDDLE_DOT } from "../../../constants/glyphs";
import { CITATION_ROLE_LABEL } from "../../../constants/labels";
import { CITATION_ROLE_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { EnumPill } from "../../../shared/EnumPill";
import { Button } from "../../../ui/Button";
import { highlightSegments } from "./highlight";

/** One cited clause: its role, the verified quote, where it comes from, and the full passage on demand. */
export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const passageId = useId();
  const location = [item.section, t("evidence.page", { n: item.page }), item.version_label].join(` ${MIDDLE_DOT} `);

  return (
    <li className="evidence">
      <div className="evidence__head">
        <EnumPill value={item.role} tones={CITATION_ROLE_TONE} labels={CITATION_ROLE_LABEL} />
        <Button variant="link" aria-expanded={open} aria-controls={passageId} onClick={() => setOpen((value) => !value)}>
          {open ? t("evidence.hidePassage") : t("evidence.showPassage")}
        </Button>
      </div>
      <blockquote className="evidence__quote">“{item.quote}”</blockquote>
      <p className="evidence__source">
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
            {item.document_title}
          </a>
        ) : (
          item.document_title
        )}
        {` ${MIDDLE_DOT} ${location}`}
      </p>
      {open && (
        <p id={passageId} className="evidence__passage">
          {highlightSegments(item.passage, item.quote).map((segment, index) =>
            segment.mark ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
          )}
        </p>
      )}
    </li>
  );
}
