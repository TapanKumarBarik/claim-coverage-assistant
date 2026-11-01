import type { Language } from "../../../api/types";
import { LANGUAGE_NAME_LABEL } from "../../../constants/labels";
import { TONE } from "../../../constants/tone";
import { useI18n } from "../../../i18n/useI18n";
import { Alert } from "../../../ui/Alert";
import { Button } from "../../../ui/Button";

interface Props {
  /** Language the answer was written in. */
  answerLanguage: Language;
  busy: boolean;
  onRerun: (language: Language) => void;
}

/** Offers to run the same question again when the answer is not in the interface language. */
export function LanguageNotice({ answerLanguage, busy, onRerun }: Props) {
  const { t, lang } = useI18n();
  if (answerLanguage === lang) return null;
  return (
    <Alert tone={TONE.NEUTRAL} role="status">
      {t("rerun.text", { from: t(LANGUAGE_NAME_LABEL[answerLanguage]) })}{" "}
      <Button variant="link" disabled={busy} onClick={() => onRerun(lang)}>
        {t("rerun.action", { to: t(LANGUAGE_NAME_LABEL[lang]) })}
      </Button>
    </Alert>
  );
}
