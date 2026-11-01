import type { Language } from "../api/types";
import { LANGUAGE } from "../constants/domain";

/** Pick `lang` from an API map such as `{ en: "...", fr: "..." }`, falling back to English. */
export function localized(map: Readonly<Record<string, string>>, lang: Language): string {
  return map[lang] ?? map[LANGUAGE.EN] ?? "";
}
