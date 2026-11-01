import { useI18n } from "../../i18n/useI18n";
import { Spinner } from "../../ui/Spinner";
import { AdminApiContext } from "./adminContext";
import { AdminWorkspace } from "./AdminWorkspace";
import { LoginForm } from "./login/LoginForm";
import { SESSION_STATE, useAdminSession } from "./useAdminSession";

/** Sign-in gate in front of the admin area: signed-out visitors see the sign-in page and nothing else. */
export function AdminPage() {
  const { t } = useI18n();
  const { state, api, signIn, signOut } = useAdminSession();

  if (state === SESSION_STATE.CHECKING) return <Spinner label={t("admin.login.checking")} />;
  if (state === SESSION_STATE.SIGNED_OUT) return <LoginForm onSignIn={signIn} />;
  return (
    <>
      <div className="page-heading">
        <h2>{t("admin.title")}</h2>
        <p className="muted">{t("admin.intro")}</p>
      </div>
      <AdminApiContext.Provider value={api}>
        <AdminWorkspace onSignOut={() => void signOut()} />
      </AdminApiContext.Provider>
    </>
  );
}
