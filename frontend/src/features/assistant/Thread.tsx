import { useEffect, useRef } from "react";
import type { ContractPublic, Language } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import type { Turn } from "./turns";

interface Props {
  turns: readonly Turn[];
  contracts: readonly ContractPublic[];
  busy: boolean;
  onRetry: (turn: Turn) => void;
  onRerun: (turn: Turn, language: Language) => void;
}

/**
 * The exchanges so far, oldest first. The newest one scrolls into view from its top when it is asked and again when
 * its answer arrives (which makes it taller), so a long answer is read from the start and none of it hides under the box.
 */
export function Thread({ turns, contracts, busy, onRetry, onRerun }: Props) {
  const { t } = useI18n();
  const latest = useRef<HTMLDivElement>(null);
  const latestId = turns.at(-1)?.id;
  const latestStatus = turns.at(-1)?.outcome.status;

  useEffect(() => {
    latest.current?.scrollIntoView?.({ block: "start" });
  }, [latestId, latestStatus]);

  return (
    <div className="thread" role="log" aria-live="polite" aria-label={t("chat.thread")}>
      {turns.map((turn, index) => (
        <div key={turn.id} ref={index === turns.length - 1 ? latest : undefined} className="turn">
          <UserMessage request={turn.request} contract={contracts.find((contract) => contract.id === turn.request.contract_id)} />
          <AssistantMessage turn={turn} busy={busy} onRetry={() => onRetry(turn)} onRerun={(language) => onRerun(turn, language)} />
        </div>
      ))}
    </div>
  );
}
