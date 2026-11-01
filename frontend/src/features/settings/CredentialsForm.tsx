import type { FormEvent } from "react";
import { CREDENTIAL_LIMITS, ENDPOINT_PLACEHOLDER } from "../../constants/credentials";
import { TONE } from "../../constants/tone";
import { useI18n } from "../../i18n/useI18n";
import { ErrorAlert } from "../../shared/ErrorAlert";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Disclosure } from "../../ui/Disclosure";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { useCredentialsForm } from "./useCredentialsForm";
import "./settings.css";
import type { FieldProblem } from "./validation";

/** Connect your own Azure OpenAI resource. The server tests the settings before accepting them. */
export function CredentialsForm() {
  const { t } = useI18n();
  const { values, problems, busy, error, saved, setField, submit } = useCredentialsForm();
  const describe = (problem: FieldProblem | undefined) => problem && t(problem.key, problem.vars);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <Card title={t("settings.form.title")}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label={t("settings.endpoint")} hint={t("settings.endpointHint")} error={describe(problems.endpoint)}>
          <TextInput
            type="text"
            inputMode="url"
            placeholder={ENDPOINT_PLACEHOLDER}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={CREDENTIAL_LIMITS.ENDPOINT_MAX}
            value={values.endpoint}
            onChange={(event) => setField("endpoint", event.target.value)}
          />
        </Field>

        <Field label={t("settings.apiKey")} hint={t("settings.apiKeyHint")} error={describe(problems.apiKey)}>
          <TextInput
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={CREDENTIAL_LIMITS.API_KEY_MAX}
            value={values.apiKey}
            onChange={(event) => setField("apiKey", event.target.value)}
          />
        </Field>

        <Field label={t("settings.reasoning")} hint={t("settings.reasoningHint")} error={describe(problems.reasoningDeployment)}>
          <TextInput
            autoComplete="off"
            spellCheck={false}
            maxLength={CREDENTIAL_LIMITS.DEPLOYMENT_MAX}
            value={values.reasoningDeployment}
            onChange={(event) => setField("reasoningDeployment", event.target.value)}
          />
        </Field>

        <Field label={t("settings.fast")} hint={t("settings.fastHint")} error={describe(problems.fastDeployment)}>
          <TextInput
            autoComplete="off"
            spellCheck={false}
            maxLength={CREDENTIAL_LIMITS.DEPLOYMENT_MAX}
            value={values.fastDeployment}
            onChange={(event) => setField("fastDeployment", event.target.value)}
          />
        </Field>

        <Disclosure summary={t("settings.advanced")}>
          <Field label={t("settings.apiVersion")} hint={t("settings.apiVersionHint")} error={describe(problems.apiVersion)}>
            <TextInput
              autoComplete="off"
              spellCheck={false}
              maxLength={CREDENTIAL_LIMITS.API_VERSION_MAX}
              value={values.apiVersion}
              onChange={(event) => setField("apiVersion", event.target.value)}
            />
          </Field>
        </Disclosure>

        <div className="credentials-form__actions">
          {error && <ErrorAlert error={error} />}
          {saved && <Alert tone={TONE.OK}>{t("settings.saved")}</Alert>}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t("settings.submitting") : t("settings.submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
