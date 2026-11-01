import type { MessageKey } from "../../../i18n/messages";

const HOURS_PER_DAY = 24;

/** Time windows offered for the governance summary (the API accepts 1 to 720 hours). */
export const WINDOW_OPTIONS: ReadonlyArray<{ hours: number; label: MessageKey }> = [
  { hours: HOURS_PER_DAY, label: "gov.window.24h" },
  { hours: 7 * HOURS_PER_DAY, label: "gov.window.7d" },
  { hours: 30 * HOURS_PER_DAY, label: "gov.window.30d" },
];
