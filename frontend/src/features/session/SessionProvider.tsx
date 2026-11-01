import { useMemo, type ReactNode } from "react";
import { sessionApi } from "../../api/session";
import { ASYNC_STATUS } from "../../constants/async";
import { useResource } from "../../hooks/useResource";
import { SessionContext, type SessionContextValue } from "./SessionContext";

/** One shared view of "which AI credentials does this browser session use", for the header, assistant and settings. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { state, reload, setData } = useResource(sessionApi.status, []);
  const value = useMemo<SessionContextValue>(
    () => ({
      session: state.status === ASYNC_STATUS.READY ? state.data : null,
      loading: state.status === ASYNC_STATUS.LOADING,
      refresh: reload,
      replace: setData,
    }),
    [state, reload, setData],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
