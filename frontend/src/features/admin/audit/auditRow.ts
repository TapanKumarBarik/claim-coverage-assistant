import type { AuditRecord } from "../../../api/types";
import { MIDDLE_DOT } from "../../../constants/glyphs";

export interface AuditRow {
  at: string;
  actor: string;
  action: string;
  /** Every other field of the record, as "key: value" pairs. */
  details: string;
}

/** The contract only promises free-form objects; `at`, `actor` and `action` are what the log writes in practice. */
const KNOWN_FIELDS = ["at", "actor", "action"] as const;

const asText = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");

export function toAuditRow(record: AuditRecord): AuditRow {
  const details = Object.entries(record)
    .filter(([key]) => !(KNOWN_FIELDS as readonly string[]).includes(key))
    .map(([key, value]) => `${key}: ${asText(value)}`)
    .join(` ${MIDDLE_DOT} `);
  return { at: asText(record.at), actor: asText(record.actor), action: asText(record.action), details };
}
