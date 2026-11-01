// All user-facing strings. `fr` is typed against `en`, so a missing translation is a compile error.
// To add German (foyer.lu also offers it): add `de.ts`, a `LANGUAGE` member in the contract, and a `de` entry here.
import type { Language } from "../api/types";
import { en, type MessageKey } from "./en";
import { fr } from "./fr";

export type { MessageKey };
export type Messages = Record<MessageKey, string>;

export const messages: Record<Language, Messages> = { en, fr };
