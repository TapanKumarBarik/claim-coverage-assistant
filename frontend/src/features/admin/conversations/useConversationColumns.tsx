import type { ConversationSummary } from "../../../api/types";
import { RESULT_KIND } from "../../../constants/domain";
import { EM_DASH } from "../../../constants/glyphs";
import { CONFIDENCE_LABEL, VERDICT_LABEL } from "../../../constants/labels";
import { VERDICT_TONE } from "../../../constants/tones";
import { TONE } from "../../../constants/tone";
import { useI18n } from "../../../i18n/useI18n";
import { EnumPill } from "../../../shared/EnumPill";
import { Button } from "../../../ui/Button";
import type { Column } from "../../../ui/DataTable";
import { Pill } from "../../../ui/Pill";
import { RatingPill } from "./RatingPill";

/** Columns of the conversations table. The question is the link that opens the conversation. */
export function useConversationColumns(onOpen: (requestId: string) => void): Column<ConversationSummary>[] {
  const { t, format } = useI18n();
  return [
    { key: "time", header: t("conv.col.time"), cell: (row) => <span className="nowrap">{format.dateTime(row.created_at)}</span> },
    {
      key: "question",
      header: t("conv.col.question"),
      cell: (row) => (
        // Plain text on purpose: this is visitor-supplied content, and React escapes it.
        <Button
          variant="link"
          className="conversation-link"
          aria-label={`${t("conv.open", { when: format.dateTime(row.created_at) })}: ${row.preview}`}
          onClick={() => onOpen(row.request_id)}
        >
          {row.preview}
        </Button>
      ),
    },
    { key: "contract", header: t("conv.col.contract"), cell: (row) => <code className="muted nowrap">{row.contract_id}</code> },
    {
      key: "result",
      header: t("conv.col.result"),
      cell: (row) =>
        row.kind === RESULT_KIND.REPLY || row.verdict === null ? (
          <Pill tone={TONE.NEUTRAL}>{t("conv.reply")}</Pill>
        ) : (
          <>
            <EnumPill value={row.verdict} tones={VERDICT_TONE} labels={VERDICT_LABEL} />
            {row.confidence && <span className="muted small conversation-confidence">{t("confidence.line", { level: t(CONFIDENCE_LABEL[row.confidence]) })}</span>}
          </>
        ),
    },
    { key: "feedback", header: t("conv.col.feedback"), cell: (row) => <RatingPill rating={row.rating} hasComment={row.has_comment} /> },
    { key: "model", header: t("conv.col.model"), cell: (row) => (row.model ? <code className="muted nowrap">{row.model}</code> : EM_DASH) },
  ];
}
