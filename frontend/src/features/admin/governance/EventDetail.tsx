import type { AiEvent } from "../../../api/types";
import { OUTCOME } from "../../../constants/domain";
import { MIDDLE_DOT } from "../../../constants/glyphs";
import { CREDENTIAL_SOURCE_LABEL, MODEL_TIER_LABEL, TOOL_LABEL } from "../../../constants/labels";
import { CREDENTIAL_SOURCE_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { entriesByCount } from "../../../lib/objects";
import { EnumPill } from "../../../shared/EnumPill";
import { useLabelFor } from "../../../shared/useLabelFor";
import { Button } from "../../../ui/Button";
import { DescriptionList, type DescriptionItem } from "../../../ui/DescriptionList";
import { useAdminNavigation } from "../adminNavigation";
import "./governance.css";

/** Only an answered or replied request leaves a conversation behind to open. */
const HAS_CONVERSATION: ReadonlySet<string> = new Set([OUTCOME.ANSWERED, OUTCOME.REPLIED]);

/** Everything the log records about one request, plus the way to its conversation. Never shows claim text. */
export function EventDetail({ event }: { event: AiEvent }) {
  const { t, format } = useI18n();
  const { openConversation } = useAdminNavigation();
  const tierLabel = useLabelFor(MODEL_TIER_LABEL);

  const items: DescriptionItem[] = [{ term: t("gov.events.detail.ref"), detail: <code>{event.request_id}</code> }];
  if (event.error_code) items.push({ term: t("gov.events.detail.error"), detail: <code>{event.error_code}</code> });
  if (event.tiers.length > 0) {
    items.push({
      term: t("gov.events.detail.models"),
      detail: (
        <>
          {event.tiers.map((tier) => t(MODEL_TIER_LABEL[tier])).join(", ")}
          {event.models.length > 0 && (
            <>
              {` ${MIDDLE_DOT} `}
              <code>{event.models.join(", ")}</code>
            </>
          )}
        </>
      ),
    });
  }
  if (event.prompt_tokens + event.completion_tokens > 0) {
    const byTier = entriesByCount(event.tokens_by_tier).map(([tier, count]) => `${tierLabel(tier)}: ${format.number(count)}`);
    items.push({
      term: t("gov.events.detail.tokens"),
      detail: [
        t("gov.events.detail.tokensSplit", { prompt: format.number(event.prompt_tokens), completion: format.number(event.completion_tokens) }),
        ...byTier,
      ].join(` ${MIDDLE_DOT} `),
    });
  }
  if (event.tools.length > 0) {
    items.push({
      term: t("gov.events.detail.tools"),
      detail: t("gov.events.detail.steps", { n: event.steps, tools: event.tools.map((tool) => t(TOOL_LABEL[tool])).join(", ") }),
    });
  }
  if (event.citations_verified + event.citations_dropped > 0) {
    items.push({
      term: t("gov.events.detail.citations"),
      detail: t("gov.kpi.citationsHint", { verified: format.number(event.citations_verified), dropped: format.number(event.citations_dropped) }),
    });
  }
  if (event.credential_source) {
    items.push({
      term: t("gov.events.detail.credentials"),
      detail: <EnumPill value={event.credential_source} tones={CREDENTIAL_SOURCE_TONE} labels={CREDENTIAL_SOURCE_LABEL} />,
    });
  }
  if (event.blocked_excerpt) {
    items.push({
      term: t("gov.events.excerpt"),
      // Plain text on purpose: this is visitor-supplied content, and React escapes it.
      detail: <span className="event-excerpt">{event.blocked_excerpt}</span>,
    });
  }

  return (
    <div className="event-detail">
      <DescriptionList items={items} />
      {HAS_CONVERSATION.has(event.outcome) && (
        <div>
          <Button small onClick={() => openConversation(event.request_id)}>
            {t("gov.events.viewConversation")}
          </Button>
        </div>
      )}
    </div>
  );
}
