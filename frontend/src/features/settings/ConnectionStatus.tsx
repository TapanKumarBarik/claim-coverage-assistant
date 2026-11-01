import type { SessionStatus } from "../../api/types";
import { CREDENTIAL_SOURCE } from "../../constants/domain";
import { CREDENTIAL_SOURCE_LABEL } from "../../constants/labels";
import { CREDENTIAL_SOURCE_TONE } from "../../constants/tones";
import { useI18n } from "../../i18n/useI18n";
import { minutesUntil } from "../../lib/dates";
import { EnumPill } from "../../shared/EnumPill";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { DescriptionList, type DescriptionItem } from "../../ui/DescriptionList";
import { EmptyState } from "../../ui/EmptyState";

interface Props {
  session: SessionStatus;
  forgetting: boolean;
  onForget: () => void;
}

/** What the browser session is connected to right now. Never shows a key: the server never sends one back. */
export function ConnectionStatus({ session, forgetting, onForget }: Props) {
  const { t } = useI18n();
  const isOwnKey = session.source === CREDENTIAL_SOURCE.SESSION;
  const minutes = minutesUntil(session.expires_at);

  const items: DescriptionItem[] = [
    {
      term: t("settings.status.source"),
      detail: <EnumPill value={session.source} tones={CREDENTIAL_SOURCE_TONE} labels={CREDENTIAL_SOURCE_LABEL} />,
    },
  ];
  if (session.endpoint_host) items.push({ term: t("settings.status.endpoint"), detail: session.endpoint_host });
  if (session.reasoning_deployment) {
    items.push(
      { term: t("settings.status.reasoning"), detail: session.reasoning_deployment },
      { term: t("settings.status.fast"), detail: session.fast_deployment ?? t("settings.status.sameAsReasoning") },
    );
  }

  return (
    <Card title={t("settings.status.title")}>
      {session.source === CREDENTIAL_SOURCE.NONE ? <EmptyState>{t("settings.status.none")}</EmptyState> : <DescriptionList items={items} />}
      {isOwnKey && minutes !== null && <p className="muted small">{t("settings.status.expires", { minutes })}</p>}
      {session.source === CREDENTIAL_SOURCE.SERVER && <p className="muted small">{t("settings.status.serverManaged")}</p>}
      {isOwnKey && (
        <Button variant="dangerOutline" disabled={forgetting} onClick={onForget}>
          {forgetting ? t("settings.forgetting") : t("settings.forget")}
        </Button>
      )}
    </Card>
  );
}
