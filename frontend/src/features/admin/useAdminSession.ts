import { useCallback, useEffect, useMemo, useState } from "react";
import { adminSessionApi, createAdminApi } from "../../api/admin";

export const SESSION_STATE = { CHECKING: "checking", SIGNED_IN: "signedIn", SIGNED_OUT: "signedOut" } as const;
export type SessionState = (typeof SESSION_STATE)[keyof typeof SESSION_STATE];

/**
 * The admin sign-in. The password is sent once and forgotten; the server answers with an HttpOnly cookie that
 * scripts cannot read, so there is nothing in the page to steal. On load the server is asked whether the
 * cookie still stands, and when any later call is refused the sign-in form comes back.
 */
export function useAdminSession() {
  const [state, setState] = useState<SessionState>(SESSION_STATE.CHECKING);

  useEffect(() => {
    let current = true;
    adminSessionApi.status().then(
      () => current && setState(SESSION_STATE.SIGNED_IN),
      () => current && setState(SESSION_STATE.SIGNED_OUT), // any refusal or failure: ask for the password
    );
    return () => {
      current = false;
    };
  }, []);

  const endSession = useCallback(() => setState(SESSION_STATE.SIGNED_OUT), []);

  /** Throws the server's refusal, so the form can explain it. */
  const signIn = useCallback(async (password: string) => {
    await adminSessionApi.signIn(password);
    setState(SESSION_STATE.SIGNED_IN);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await adminSessionApi.signOut();
    } finally {
      setState(SESSION_STATE.SIGNED_OUT); // even if the server was unreachable, this page stops acting as an admin
    }
  }, []);

  const api = useMemo(() => createAdminApi({ onUnauthorized: endSession }), [endSession]);
  return { state, api, signIn, signOut };
}
