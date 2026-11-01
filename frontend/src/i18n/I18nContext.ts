import { createContext } from "react";
import type { Language } from "../api/types";
import type { Formatters } from "./format";
import type { Translate } from "./translate";

export interface I18n {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translate;
  format: Formatters;
}

export const I18nContext = createContext<I18n | null>(null);
