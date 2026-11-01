import { useState, type FormEvent } from "react";
import { RATING } from "../../constants/domain";
import { FEEDBACK_COMMENT_MAX_CHARS } from "../../constants/limits";
import { useI18n } from "../../i18n/useI18n";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { ThumbDownIcon, ThumbUpIcon } from "../../ui/icons";
import { TextArea } from "../../ui/TextArea";
import { FEEDBACK_STATUS, useFeedback } from "./useFeedback";
import "./feedback.css";

/**
 * "Was this answer helpful?" at the end of an answer. Like or dislike is saved at once; a dislike also offers a
 * short comment. The state is announced politely so a screen reader hears the outcome without losing its place.
 */
export function FeedbackBar({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const feedback = useFeedback(requestId);
  const [comment, setComment] = useState("");

  const message =
    feedback.status === FEEDBACK_STATUS.FAILED
      ? t("feedback.error")
      : feedback.commentSent
        ? t("feedback.sent")
        : feedback.status === FEEDBACK_STATUS.SAVED
          ? t("feedback.thanks")
          : "";

  function submitComment(event: FormEvent) {
    event.preventDefault();
    void feedback.sendComment(comment);
  }

  return (
    <div className="feedback" role="group" aria-label={t("feedback.group")}>
      <div className="feedback__row">
        <span className="feedback__prompt">{t("feedback.prompt")}</span>
        {[
          { rating: RATING.UP, label: t("feedback.up"), icon: <ThumbUpIcon width={18} height={18} /> },
          { rating: RATING.DOWN, label: t("feedback.down"), icon: <ThumbDownIcon width={18} height={18} /> },
        ].map(({ rating, label, icon }) => (
          <button
            key={rating}
            type="button"
            className="feedback__button"
            data-rating={rating}
            aria-pressed={feedback.rating === rating}
            aria-label={label}
            title={label}
            aria-busy={feedback.saving}
            onClick={() => {
              if (feedback.saving) return;
              setComment(""); // a comment belongs to the rating it was written for
              void feedback.choose(rating);
            }}
          >
            {icon}
          </button>
        ))}
        <span className={feedback.status === FEEDBACK_STATUS.FAILED ? "feedback__message feedback__message--error" : "feedback__message"} role="status">
          {message}
        </span>
      </div>
      {feedback.rating === RATING.DOWN && !feedback.commentSent && (
        <form className="feedback__comment" onSubmit={submitComment}>
          <Field label={t("feedback.comment")} hint={t("feedback.commentHint")}>
            <TextArea rows={2} maxLength={FEEDBACK_COMMENT_MAX_CHARS} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <Button type="submit" small disabled={feedback.saving || comment.trim().length === 0}>
            {t("feedback.send")}
          </Button>
        </form>
      )}
    </div>
  );
}
