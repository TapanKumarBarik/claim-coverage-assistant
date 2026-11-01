import { useCallback, useState } from "react";
import type { AnalyzeRequest, Example, Language } from "../../api/types";
import { todayIso } from "../../lib/dates";
import { localized } from "../../lib/localized";

export interface ComposerValues {
  contractId: string;
  text: string;
  lossDate: string;
}

/** The body of `POST /api/analyze` for the composer. The text is trimmed; an empty date means "today" server-side. */
export function buildAnalyzeRequest(values: ComposerValues, language: Language): AnalyzeRequest {
  return {
    contract_id: values.contractId,
    claim: values.text.trim(),
    loss_date: values.lossDate || null,
    language,
  };
}

/** What the message box and its two options hold. The only rule: there must be some text (the server decides the rest). */
export function useComposer(initialContractId: string) {
  const [contractId, setContractId] = useState(initialContractId);
  const [text, setText] = useState("");
  const [lossDate, setLossDate] = useState(todayIso);

  const applyExample = useCallback((example: Example, language: Language) => {
    setContractId(example.contract_id);
    setText(localized(example.claim, language));
  }, []);

  const clearText = useCallback(() => setText(""), []);

  return {
    values: { contractId, text, lossDate } satisfies ComposerValues,
    canSend: text.trim().length > 0 && contractId !== "",
    setContractId,
    setText,
    setLossDate,
    applyExample,
    clearText,
  };
}

export type ComposerModel = ReturnType<typeof useComposer>;
