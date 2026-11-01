import { useCallback, useState } from "react";
import { publicApi } from "../../api/public";
import type { Rating } from "../../api/types";

export const FEEDBACK_STATUS = { IDLE: "idle", SAVING: "saving", SAVED: "saved", FAILED: "failed" } as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS)[keyof typeof FEEDBACK_STATUS];

/**
 * One visitor's rating of one answer. A rating is saved the moment it is chosen; a comment is a second, optional
 * step on a dislike. The rating shown is always one the server has confirmed, never a hopeful guess.
 */
export function useFeedback(requestId: string) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [status, setStatus] = useState<FeedbackStatus>(FEEDBACK_STATUS.IDLE);
  const [commentSent, setCommentSent] = useState(false);

  const save = useCallback(
    async (next: Rating, comment?: string) => {
      setStatus(FEEDBACK_STATUS.SAVING);
      try {
        await publicApi.feedback({ request_id: requestId, rating: next, comment: comment || null });
        setRating(next);
        setCommentSent(Boolean(comment)); // a new rating starts without a comment; a comment is only ever sent along with its rating
        setStatus(FEEDBACK_STATUS.SAVED);
      } catch {
        setStatus(FEEDBACK_STATUS.FAILED);
      }
    },
    [requestId],
  );

  return {
    rating,
    status,
    commentSent,
    saving: status === FEEDBACK_STATUS.SAVING,
    choose: (next: Rating) => (next === rating ? Promise.resolve() : save(next)),
    sendComment: (comment: string) => save(rating ?? "down", comment.trim()),
  };
}
