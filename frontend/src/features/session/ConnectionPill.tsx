import { CREDENTIAL_SOURCE } from "../../constants/domain";
import { CREDENTIAL_SOURCE_TONE } from "../../constants/tones";
import { ROUTE_HASH, ROUTE } from "../../app/routes";
import { useI18n } from "../../i18n/useI18n";
import { Pill } from "../../ui/Pill";
import { useSession } from "./useSession";
import "./ConnectionPill.css";

/** Header badge: which AI credentials are in use. Links to the settings page. */
export function ConnectionPill({ current = false }: { current?: boolean }) {
  const { t } = useI18n();
  const { session } = useSession();
  if (!session) return null;

  const connected = session.source !== CREDENTIAL_SOURCE.NONE;
  const host = session.endpoint_host ?? t("session.serverHost");
  return (
    <a className="connection-pill" href={ROUTE_HASH[ROUTE.SETTINGS]} aria-current={current ? "page" : undefined}>
      <Pill tone={CREDENTIAL_SOURCE_TONE[session.source]}>
        {connected ? t("session.connected", { host }) : t("session.notConnected")}
      </Pill>
    </a>
  );
}
