import type { Confidence, DocKind } from "../../../api/types";
import { CONFIDENCE_LABEL, EVIDENCE_STRENGTH_LABEL, NO_EVIDENCE_STRENGTH_LABEL } from "../../../constants/labels";
import { CONFIDENCE_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { Pill } from "../../../ui/Pill";

interface Props {
  confidence: Confidence | null;
  /** The best kind of document a verified quote came from, if any. */
  evidenceStrength: DocKind | null;
}

export function ConfidenceLine({ confidence, evidenceStrength }: Props) {
  const { t } = useI18n();
  const basis = evidenceStrength ? EVIDENCE_STRENGTH_LABEL[evidenceStrength] : NO_EVIDENCE_STRENGTH_LABEL;
  return (
    <p className="confidence">
      {confidence && (
        <Pill tone={CONFIDENCE_TONE[confidence]}>{t("confidence.line", { level: t(CONFIDENCE_LABEL[confidence]) })}</Pill>
      )}
      <span>{t(basis)}</span>
    </p>
  );
}
