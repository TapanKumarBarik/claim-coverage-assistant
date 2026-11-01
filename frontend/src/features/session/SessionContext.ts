import { createContext } from "react";
import type { SessionStatus } from "../../api/types";

export interface SessionContextValue {
  /** `null` until the first answer, or when the status call failed (the server then decides on each request). */
  session: SessionStatus | null;
  loading: boolean;
  /** Ask the server again, for example after the key was forgotten or a request said credentials are missing. */
  refresh: () => void;
  /** Use a status already in hand (the response of saving credentials). */
  replace: (status: SessionStatus) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
