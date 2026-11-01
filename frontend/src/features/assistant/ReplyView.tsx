import type { ReplyResponse } from "../../api/types";
import { MIDDLE_DOT } from "../../constants/glyphs";
import { useI18n } from "../../i18n/useI18n";
import { GeneratedAt } from "./GeneratedAt";

/** A short answer to a greeting or an off-topic message: plain text, no verdict, no evidence. */
export function ReplyView({ reply }: { reply: ReplyResponse }) {
  const { t } = useI18n();
  return (
    <article className="reply" aria-label={t("reply.title")}>
      <p className="reply__text">{reply.text}</p>
      <p className="muted small">
        <GeneratedAt iso={reply.generated_at} /> {MIDDLE_DOT} {t("reply.meta", { model: reply.model, id: reply.request_id })}
      </p>
    </article>
  );
}
