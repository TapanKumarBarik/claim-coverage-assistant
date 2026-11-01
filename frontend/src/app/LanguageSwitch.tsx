import { LANGUAGES } from "../constants/domain";
import { useI18n } from "../i18n/useI18n";

/** EN / FR toggle. Each button is marked with its own `lang` so screen readers pronounce it correctly. */
export function LanguageSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="language-switch" role="group" aria-label={t("lang.label")}>
      {LANGUAGES.map((code) => (
        <button key={code} type="button" lang={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
