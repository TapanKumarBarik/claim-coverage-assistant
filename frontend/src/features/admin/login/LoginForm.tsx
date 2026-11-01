import { useState, type FormEvent } from "react";
import { ROUTE, ROUTE_HASH } from "../../../app/routes";
import { useI18n } from "../../../i18n/useI18n";
import { BrandMark } from "../../../ui/BrandMark";
import { Button } from "../../../ui/Button";
import { Field } from "../../../ui/Field";
import { TextInput } from "../../../ui/TextInput";
import { describeLoginError } from "./loginError";
import "./login.css";

/** The page an administrator meets first: nothing of the admin area is shown until the password is accepted. */
export function LoginForm({ onSignIn }: { onSignIn: (password: string) => Promise<void> }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await onSignIn(password);
    } catch (caught) {
      setProblem(describeLoginError(t, caught));
      setBusy(false);
    }
  }

  return (
    <section className="login" aria-labelledby="login-title">
      <BrandMark size="large" />
      <h2 id="login-title">{t("admin.login.title")}</h2>
      <p className="muted login__intro">{t("admin.login.intro")}</p>
      <form className="login__form" onSubmit={(event) => void submit(event)}>
        <Field label={t("admin.login.password")} error={problem}>
          <TextInput
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || password.length === 0}>
          {busy ? t("admin.login.submitting") : t("admin.login.submit")}
        </Button>
      </form>
      <a className="login__back" href={ROUTE_HASH[ROUTE.ASSISTANT]}>
        {t("admin.login.back")}
      </a>
    </section>
  );
}
