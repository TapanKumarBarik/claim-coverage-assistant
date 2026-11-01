import type { Language } from "../api/types";
import { messages, type MessageKey } from "./messages";

export type TranslationVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslationVars) => string;

/** A `t()` function for one language: looks the key up and fills `{name}` placeholders. */
export function createTranslator(lang: Language): Translate {
  return (key, vars) =>
    messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}
