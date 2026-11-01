import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Language } from "../api/types";
import { LANGUAGE, LANGUAGES } from "../constants/domain";
import { isOneOf } from "../constants/enumOf";
import { STORAGE_KEY } from "../constants/storage";
import { persistentStorage } from "../lib/browserStorage";
import { I18nContext, type I18n } from "./I18nContext";
import { createFormatters } from "./format";
import { messages } from "./messages";
import { createTranslator } from "./translate";

/** The saved choice, else the browser's language, else English. */
function detectLanguage(): Language {
  const stored = persistentStorage.get(STORAGE_KEY.LANGUAGE);
  if (isOneOf(LANGUAGES, stored)) return stored;
  return navigator.language?.toLowerCase().startsWith(LANGUAGE.FR) ? LANGUAGE.FR : LANGUAGE.EN;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = messages[lang]["app.title"];
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    persistentStorage.set(STORAGE_KEY.LANGUAGE, next);
  }, []);

  const value = useMemo<I18n>(() => {
    const t = createTranslator(lang);
    return { lang, setLang, t, format: createFormatters(lang, t) };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
