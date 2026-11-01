import { CREDENTIAL_SOURCE } from "../../constants/domain";
import { TONE } from "../../constants/tone";
import { useI18n } from "../../i18n/useI18n";
import { ErrorAlert } from "../../shared/ErrorAlert";
import { Alert } from "../../ui/Alert";
import { Spinner } from "../../ui/Spinner";
import { useSession } from "../session/useSession";
import { ConnectionStatus } from "./ConnectionStatus";
import { CredentialsForm } from "./CredentialsForm";
import { KeyPrivacyPanel } from "./KeyPrivacyPanel";
import { useForgetCredentials } from "./useForgetCredentials";

export function SettingsPage() {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const forgetting = useForgetCredentials();
  // While the status is unknown, offer the form anyway: the server has the final say on every save.
  const byoAllowed = session?.byo_allowed ?? true;

  return (
    <>
      <div className="page-heading">
        <h2>{t("settings.title")}</h2>
        <p className="muted">{t("settings.intro")}</p>
      </div>
      <div className="split">
        <div className="stack">
          {loading && <Spinner label={t("common.loading")} />}
          {session && <ConnectionStatus session={session} forgetting={forgetting.busy} onForget={() => void forgetting.forget()} />}
          {forgetting.done && session?.source === CREDENTIAL_SOURCE.NONE && <Alert tone={TONE.OK}>{t("settings.forgot")}</Alert>}
          {forgetting.error && <ErrorAlert error={forgetting.error} />}
          {byoAllowed ? <CredentialsForm /> : <Alert tone={TONE.NEUTRAL}>{t("settings.byoDisabled")}</Alert>}
        </div>
        <KeyPrivacyPanel />
      </div>
    </>
  );
}
