import type { AnalyzeRequest, AnalyzeResponse } from "../../api/types";
import { MAX_TURNS } from "../../constants/limits";

export const TURN_STATUS = { PENDING: "pending", DONE: "done", FAILED: "failed" } as const;

export type TurnOutcome =
  | { status: typeof TURN_STATUS.PENDING }
  | { status: typeof TURN_STATUS.DONE; result: AnalyzeResponse }
  | { status: typeof TURN_STATUS.FAILED; error: Error };

/** One exchange: what was asked and how it turned out. Each is answered on its own; the server keeps no chat history. */
export interface Turn {
  id: number;
  request: AnalyzeRequest;
  outcome: TurnOutcome;
}

export const PENDING: TurnOutcome = { status: TURN_STATUS.PENDING };

export function appendTurn(turns: readonly Turn[], turn: Turn): Turn[] {
  return [...turns, turn].slice(-MAX_TURNS);
}

/** Changes one turn. An unknown id (the chat was cleared meanwhile) changes nothing. */
export function patchTurn(turns: readonly Turn[], id: number, patch: Partial<Pick<Turn, "request" | "outcome">>): Turn[] {
  return turns.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn));
}

export function removeTurn(turns: readonly Turn[], id: number): Turn[] {
  return turns.filter((turn) => turn.id !== id);
}

export const isPending = (turn: Turn) => turn.outcome.status === TURN_STATUS.PENDING;
