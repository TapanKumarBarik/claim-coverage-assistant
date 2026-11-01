import { isOneOf } from "../constants/enumOf";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/useI18n";

/**
 * Label lookup for keys the API sends as free-form strings (`{ [key: string]: number }` maps):
 * a known enum value gets its localized label, anything else is shown as sent.
 */
export function useLabelFor<T extends string>(labels: Readonly<Record<T, MessageKey>>) {
  const { t } = useI18n();
  const known = Object.keys(labels) as T[];
  return (key: string): string => (isOneOf(known, key) ? t(labels[key]) : key);
}
