import { useCallback, useRef, useState } from "react";
import { isApiError } from "../../api/errors";
import { publicApi } from "../../api/public";
import type { AnalyzeRequest, Language } from "../../api/types";
import { ERROR_CODE } from "../../constants/domain";
import { useSession } from "../session/useSession";
import { PENDING, TURN_STATUS, appendTurn, isPending, patchTurn, removeTurn, type Turn } from "./turns";

interface Options {
  /** The server has no AI credentials for this browser session; the message was not answered and is handed back. */
  onCredentialsRequired: (request: AnalyzeRequest) => void;
}

/**
 * The thread of questions and answers, in memory only. Missing credentials are not an error to show: the turn is
 * taken back, the shared session status is refreshed, and the caller is told so it can point to Settings.
 */
export function useConversation({ onCredentialsRequired }: Options) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [credentialsRequired, setCredentialsRequired] = useState(false);
  const nextId = useRef(0);
  const { refresh } = useSession();

  const execute = useCallback(
    async (id: number, request: AnalyzeRequest) => {
      try {
        const result = await publicApi.analyze(request);
        setTurns((previous) => patchTurn(previous, id, { outcome: { status: TURN_STATUS.DONE, result } }));
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        if (isApiError(error, ERROR_CODE.CREDENTIALS_REQUIRED)) {
          refresh();
          setCredentialsRequired(true);
          setTurns((previous) => removeTurn(previous, id));
          onCredentialsRequired(request);
          return;
        }
        setTurns((previous) => patchTurn(previous, id, { outcome: { status: TURN_STATUS.FAILED, error } }));
      }
    },
    [refresh, onCredentialsRequired],
  );

  const send = useCallback(
    (request: AnalyzeRequest) => {
      const id = nextId.current++;
      setCredentialsRequired(false);
      setTurns((previous) => appendTurn(previous, { id, request, outcome: PENDING }));
      void execute(id, request);
    },
    [execute],
  );

  /** Asks the same question again in place, optionally in another language. */
  const rerun = useCallback(
    (turn: Turn, language: Language = turn.request.language) => {
      const request = { ...turn.request, language };
      setTurns((previous) => patchTurn(previous, turn.id, { request, outcome: PENDING }));
      void execute(turn.id, request);
    },
    [execute],
  );

  const reset = useCallback(() => {
    setTurns([]);
    setCredentialsRequired(false);
  }, []);

  return { turns, busy: turns.some(isPending), credentialsRequired, send, rerun, reset };
}
