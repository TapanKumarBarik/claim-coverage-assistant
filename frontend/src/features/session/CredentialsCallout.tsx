import { ROUTE, ROUTE_HASH } from "../../app/routes";
import { TONE } from "../../constants/tone";
import { useI18n } from "../../i18n/useI18n";
import { Alert } from "../../ui/Alert";
import "./CredentialsCallout.css";

/**
 * Shown when the assistant has no AI credentials to use. If visitors may bring their own, it points to Settings;
 * otherwise it says plainly that the server has no AI configured.
 */
export function CredentialsCallout({ byoAllowed }: { byoAllowed: boolean }) {
  const { t } = useI18n();
  if (!byoAllowed) {
    return (
      <Alert tone={TONE.NEUTRAL} title={t("callout.noAi.title")}>
        <p>{t("callout.noAi.body")}</p>
      </Alert>
    );
  }
  return (
    <Alert tone={TONE.INFO} className="callout" title={t("callout.title")}>
      <p>{t("callout.body")}</p>
      <a className="callout__action" href={ROUTE_HASH[ROUTE.SETTINGS]}>
        {t("callout.action")}
      </a>
    </Alert>
  );
}
