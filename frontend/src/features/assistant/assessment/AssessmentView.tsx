import { useId } from "react";
import type { AssessmentResponse, Language } from "../../../api/types";
import { MIDDLE_DOT } from "../../../constants/glyphs";
import { useI18n } from "../../../i18n/useI18n";
import { ListBlock } from "../../../ui/ListBlock";
import { GeneratedAt } from "../GeneratedAt";
import { CaveatList } from "./CaveatList";
import { ConfidenceLine } from "./ConfidenceLine";
import { DocumentsUsed } from "./DocumentsUsed";
import { EvidenceList } from "./EvidenceList";
import { LanguageNotice } from "./LanguageNotice";
import { VerdictBanner } from "./VerdictBanner";
import "./assessment.css";

interface Props {
  result: AssessmentResponse;
  busy?: boolean;
  /** Offered when the answer is not in the interface language. Leave out to show the answer read-only. */
  onRerun?: (language: Language) => void;
}

/** The full cited answer to a claim. */
export function AssessmentView({ result, busy = false, onRerun }: Props) {
  const { t, format } = useI18n();
  const headingId = useId();
  return (
    <article className="assessment" aria-labelledby={headingId}>
      <VerdictBanner verdict={result.verdict} headline={result.headline} headingId={headingId} />
      <ConfidenceLine confidence={result.confidence} evidenceStrength={result.evidence_strength} />
      {onRerun && <LanguageNotice answerLanguage={result.language} busy={busy} onRerun={onRerun} />}
      <p className="assessment__reasoning">{result.reasoning}</p>
      <EvidenceList evidence={result.evidence} />
      <ListBlock title={t("missing.title")} items={result.missing_information} />
      <ListBlock title={t("next.title")} items={result.next_steps} />
      <CaveatList caveats={result.caveats} />
      <DocumentsUsed documents={result.documents_used} />
      <footer className="assessment__footer">
        <p>{result.disclaimer}</p>
        <p className="muted">
          <GeneratedAt iso={result.generated_at} /> {MIDDLE_DOT}{" "}
          {t("meta.line", { duration: format.duration(result.latency_ms), model: result.model, id: result.request_id })}
        </p>
      </footer>
    </article>
  );
}
