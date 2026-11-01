import { useCallback, useRef } from "react";
import type { AnalyzeRequest, ContractPublic, Example } from "../../api/types";
import { CREDENTIAL_SOURCE } from "../../constants/domain";
import { useI18n } from "../../i18n/useI18n";
import { Button } from "../../ui/Button";
import { CredentialsCallout } from "../session/CredentialsCallout";
import { useSession } from "../session/useSession";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { Thread } from "./Thread";
import { buildAnalyzeRequest, useComposer } from "./useComposer";
import { useConversation } from "./useConversation";
import "./chat.css";

interface Props {
  contracts: readonly ContractPublic[];
  examples: readonly Example[];
}

/** A chat: the conversation above, the message box pinned below, and a prompt to open Settings when the AI cannot be reached. */
export function AssistantWorkspace({ contracts, examples }: Props) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const composer = useComposer(contracts[0]?.id ?? "");
  const input = useRef<HTMLTextAreaElement>(null);

  const { setText } = composer;
  // A message that was not answered for lack of credentials goes back to the box, unless the user has typed something new.
  const restoreDraft = useCallback((request: AnalyzeRequest) => setText((draft) => draft || request.claim), [setText]);
  const conversation = useConversation({ onCredentialsRequired: restoreDraft });

  const hasNoCredentials = session?.source === CREDENTIAL_SOURCE.NONE;
  const showCallout = hasNoCredentials || conversation.credentialsRequired;
  const chosenContract = contracts.find((contract) => contract.id === composer.values.contractId);

  function send() {
    if (!composer.canSend || conversation.busy || hasNoCredentials) return;
    conversation.send(buildAnalyzeRequest(composer.values, lang));
    composer.clearText();
  }

  function pickExample(example: Example) {
    composer.applyExample(example, lang);
    input.current?.focus();
  }

  return (
    <div className="chat">
      {conversation.turns.length === 0 ? (
        <EmptyChat examples={examples} contract={chosenContract} onPick={pickExample} />
      ) : (
        <>
          <div className="chat__toolbar">
            <Button small onClick={conversation.reset}>
              {t("chat.newChat")}
            </Button>
          </div>
          <Thread
            turns={conversation.turns}
            contracts={contracts}
            busy={conversation.busy}
            onRetry={(turn) => conversation.rerun(turn)}
            onRerun={conversation.rerun}
          />
        </>
      )}
      <div className="composer-dock">
        {showCallout && <CredentialsCallout byoAllowed={session?.byo_allowed ?? true} />}
        <Composer
          contracts={contracts}
          model={composer}
          busy={conversation.busy}
          sendDisabled={hasNoCredentials}
          onSend={send}
          inputRef={input}
        />
        <p className="composer-dock__note">{t("chat.note")}</p>
      </div>
    </div>
  );
}
