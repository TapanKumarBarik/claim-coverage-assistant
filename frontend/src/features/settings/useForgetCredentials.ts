import { useState } from "react";
import { sessionApi } from "../../api/session";
import { useSession } from "../session/useSession";

/** "Forget my credentials": asks the server to drop the key, then refreshes the shared session status. */
export function useForgetCredentials() {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [done, setDone] = useState(false);

  async function forget() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await sessionApi.forget();
      setDone(true);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setBusy(false);
    }
  }

  return { forget, busy, error, done };
}
