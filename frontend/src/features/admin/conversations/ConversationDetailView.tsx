import { useState } from "react";
import type { ConversationDetail } from "../../../api/types";
import { RESULT_KIND } from "../../../constants/domain";
import { LANGUAGE_NAME_LABEL } from "../../../constants/labels";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { ErrorAlert } from "../../../shared/ErrorAlert";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { ConfirmPanel } from "../../../ui/ConfirmPanel";
import { DescriptionList } from "../../../ui/DescriptionList";
import { AssessmentView } from "../../assistant/assessment/AssessmentView";
import { ReplyView } from "../../assistant/ReplyView";
import { useAdminApi } from "../adminContext";
import { RatingPill } from "./RatingPill";

interface Props {
  requestId: string;
  onBack: () => void;
}

/** One conversation: what was asked, the answer as the visitor saw it, and how they rated it. */
export function ConversationDetailView({ requestId, onBack }: Props) {
  const { t, format } = useI18n();
  const api = useAdminApi();
  const { state, reload } = useResource(() => api.conversation(requestId), [api, requestId]);

  return (
    <div className="stack">
      <div>
        <Button variant="link" onClick={onBack}>
          {`← ${t("conv.detail.back")}`}
        </Button>
      </div>
      <AsyncView state={state} onRetry={reload}>
        {(conversation) => (
          <>
            <Card title={t("conv.detail.title")}>
              <DescriptionList
                items={[
                  { term: t("conv.detail.generated"), detail: <time dateTime={conversation.created_at}>{format.dateTime(conversation.created_at)}</time> },
                  { term: t("conv.detail.contract"), detail: <code>{conversation.contract_id}</code> },
                  { term: t("conv.detail.language"), detail: t(LANGUAGE_NAME_LABEL[conversation.language]) },
                  { term: t("conv.detail.model"), detail: <code>{conversation.model}</code> },
                  { term: t("conv.detail.latency"), detail: format.duration(conversation.latency_ms) },
                  { term: t("conv.detail.ref"), detail: <code>{conversation.request_id}</code> },
                ]}
              />
            </Card>
            <Card title={t("conv.detail.feedback")}>
              <FeedbackSummary conversation={conversation} />
            </Card>
            <Card title={t("conv.detail.question")}>
              {/* Plain text on purpose: this is visitor-supplied content, and React escapes it. */}
              <p className="conversation-question">{conversation.question}</p>
            </Card>
            <Card title={t("conv.detail.answer")}>
              {conversation.response === null ? (
                <p className="muted">{t("conv.detail.unreadable")}</p>
              ) : conversation.response.kind === RESULT_KIND.ASSESSMENT ? (
                <AssessmentView result={conversation.response} />
              ) : (
                <ReplyView reply={conversation.response} />
              )}
            </Card>
            <DeleteConversation requestId={conversation.request_id} onDeleted={onBack} />
          </>
        )}
      </AsyncView>
    </div>
  );
}

function FeedbackSummary({ conversation }: { conversation: ConversationDetail }) {
  const { t, format } = useI18n();
  if (conversation.rating === null) return <p className="muted">{t("conv.detail.noFeedback")}</p>;
  return (
    <div className="stack">
      <p>
        <RatingPill rating={conversation.rating} hasComment={false} />
        {conversation.rated_at && <span className="muted small"> {format.dateTime(conversation.rated_at)}</span>}
      </p>
      {conversation.comment && (
        <>
          <h4>{t("conv.detail.comment")}</h4>
          <blockquote className="conversation-comment">{conversation.comment}</blockquote>
        </>
      )}
    </div>
  );
}

function DeleteConversation({ requestId, onDeleted }: { requestId: string; onDeleted: () => void }) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteConversation(requestId);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error && <ErrorAlert error={error} />}
      {confirming ? (
        <ConfirmPanel
          title={t("conv.delete")}
          message={t("conv.delete.confirm")}
          confirmLabel={t("conv.delete.confirmLabel")}
          cancelLabel={t("action.cancel")}
          destructive
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div>
          <Button variant="dangerOutline" onClick={() => setConfirming(true)}>
            {t("conv.delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
