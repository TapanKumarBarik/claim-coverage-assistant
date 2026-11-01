import type { AiEvent } from "../../../api/types";
import { EM_DASH, MIDDLE_DOT } from "../../../constants/glyphs";
import { CONFIDENCE_LABEL, GUARD_CODE_LABEL, INTENT_LABEL, OUTCOME_LABEL, VERDICT_LABEL } from "../../../constants/labels";
import { GUARD_CODE_TONE, OUTCOME_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { EnumPill } from "../../../shared/EnumPill";
import { Button } from "../../../ui/Button";
import type { Column } from "../../../ui/DataTable";
import { Pill } from "../../../ui/Pill";
import { VisuallyHidden } from "../../../ui/VisuallyHidden";
import "./governance.css";

/** Which row is open, and how to open or close one. */
export interface RowExpansion {
  isOpen: (event: AiEvent) => boolean;
  toggle: (event: AiEvent) => void;
}

/**
 * Columns of the recent-requests table: only what is needed to scan a list. Everything else about a request is in
 * its detail row. Never shows claim text, only what happened to it.
 */
export function useEventColumns(expansion: RowExpansion): Column<AiEvent>[] {
  const { t, format } = useI18n();
  return [
    { key: "time", header: t("gov.events.col.time"), cell: (e) => format.dateTime(e.ts) },
    { key: "outcome", header: t("gov.events.col.outcome"), cell: (e) => <EnumPill value={e.outcome} tones={OUTCOME_TONE} labels={OUTCOME_LABEL} /> },
    {
      key: "what",
      header: t("gov.events.col.what"),
      cell: (e) =>
        [e.intent && t(INTENT_LABEL[e.intent]), e.verdict && t(VERDICT_LABEL[e.verdict]), e.confidence && t(CONFIDENCE_LABEL[e.confidence])]
          .filter(Boolean)
          .join(` ${MIDDLE_DOT} `) || EM_DASH,
    },
    { key: "tokens", header: t("gov.events.col.tokens"), numeric: true, cell: (e) => format.number(e.prompt_tokens + e.completion_tokens) },
    { key: "latency", header: t("gov.events.col.latency"), numeric: true, cell: (e) => format.duration(e.latency_ms) },
    {
      key: "guards",
      header: t("gov.events.col.guards"),
      // Only requests a guardrail touched show anything here.
      cell: (e) =>
        e.guard_flags.length > 0 && (
          <span className="flag-list">
            {e.guard_flags.map((flag) => (
              <Pill key={flag} tone={GUARD_CODE_TONE[flag]}>
                {t(GUARD_CODE_LABEL[flag])}
              </Pill>
            ))}
          </span>
        ),
    },
    {
      key: "details",
      header: <VisuallyHidden>{t("gov.events.col.details")}</VisuallyHidden>,
      cell: (e) => (
        <Button variant="link" aria-expanded={expansion.isOpen(e)} onClick={() => expansion.toggle(e)}>
          {expansion.isOpen(e) ? t("gov.events.hideDetails") : t("gov.events.details")}
        </Button>
      ),
    },
  ];
}
