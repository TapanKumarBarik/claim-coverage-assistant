import { useState } from "react";
import { sessionApi } from "../../api/session";
import { useSession } from "../session/useSession";
import { EMPTY_CREDENTIALS, toCredentialsInput, validateCredentials, type CredentialsFormValues } from "./validation";

/**
 * State and submit logic of the credentials form.
 *
 * The API key is cleared from state the moment the request is built, before it is sent, whatever happens
 * next: nothing in React state, the DOM or an error object can hold on to it.
 */
export function useCredentialsForm() {
  const { replace } = useSession();
  const [values, setValues] = useState<CredentialsFormValues>(EMPTY_CREDENTIALS);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saved, setSaved] = useState(false);

  const problems = touched ? validateCredentials(values) : {};

  function setField(field: keyof CredentialsFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function submit() {
    if (busy) return;
    if (Object.keys(validateCredentials(values)).length > 0) {
      setTouched(true);
      return;
    }
    const input = toCredentialsInput(values);
    setValues((previous) => ({ ...previous, apiKey: "" }));
    setTouched(false);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      replace(await sessionApi.save(input));
      setValues(EMPTY_CREDENTIALS);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setBusy(false);
    }
  }

  return { values, problems, busy, error, saved, setField, submit };
}
