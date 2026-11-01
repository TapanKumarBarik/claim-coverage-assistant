import type { Language } from "../../api/types";
import { RESULT_KIND } from "../../constants/domain";
import { useI18n } from "../../i18n/useI18n";
import { ErrorAlert } from "../../shared/ErrorAlert";
import { Button } from "../../ui/Button";
import { AssistantIcon } from "../../ui/icons";
import { TypingDots } from "../../ui/TypingDots";
import { AssessmentView } from "./assessment/AssessmentView";
import { FeedbackBar } from "./FeedbackBar";
import { ReplyView } from "./ReplyView";
import { TURN_STATUS, type Turn } from "./turns";

interface Props {
  turn: Turn;
  /** Another answer is being written, so asking again has to wait. */
  busy: boolean;
  onRetry: () => void;
  onRerun: (language: Language) => void;
}

/** The assistant's side of one exchange: working, failed (with a retry), a short reply, or a cited assessment. */
export function AssistantMessage({ turn, busy, onRetry, onRerun }: Props) {
  const { t } = useI18n();
  const { outcome } = turn;
  return (
    <div className="message message--assistant" aria-busy={outcome.status === TURN_STATUS.PENDING}>
      <span className="message__avatar">
        <AssistantIcon width={18} height={18} />
      </span>
      <div className="message__body">
        {outcome.status === TURN_STATUS.PENDING && <TypingDots label={t("result.loading")} />}
        {outcome.status === TURN_STATUS.FAILED && (
          <>
            <ErrorAlert error={outcome.error} />
            <Button variant="link" disabled={busy} onClick={onRetry}>
              {t("common.retry")}
            </Button>
          </>
        )}
        {outcome.status === TURN_STATUS.DONE && outcome.result.kind === RESULT_KIND.REPLY && <ReplyView reply={outcome.result} />}
        {outcome.status === TURN_STATUS.DONE && outcome.result.kind === RESULT_KIND.ASSESSMENT && (
          <AssessmentView result={outcome.result} busy={busy} onRerun={onRerun} />
        )}
        {outcome.status === TURN_STATUS.DONE && <FeedbackBar key={outcome.result.request_id} requestId={outcome.result.request_id} />}
      </div>
    </div>
  );
}
