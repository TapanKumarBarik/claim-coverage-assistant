import { useId, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { ContractPublic } from "../../api/types";
import { KEY } from "../../constants/keys";
import { COUNTER_VISIBLE_RATIO, MAX_CLAIM_CHARS } from "../../constants/limits";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import { useI18n } from "../../i18n/useI18n";
import { todayIso } from "../../lib/dates";
import { ArrowUpIcon } from "../../ui/icons";
import { TextArea } from "../../ui/TextArea";
import { TextInput } from "../../ui/TextInput";
import { VisuallyHidden } from "../../ui/VisuallyHidden";
import { ContractPicker } from "./ContractPicker";
import type { ComposerModel } from "./useComposer";
import "./composer.css";

interface Props {
  contracts: readonly ContractPublic[];
  model: ComposerModel;
  /** An answer is still being written. */
  busy: boolean;
  /** Sending is not possible (for example, no AI credentials yet). Typing and examples still work. */
  sendDisabled: boolean;
  onSend: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

/** The message box, pinned to the bottom of the chat: Enter sends, Shift+Enter adds a line. */
export function Composer({ contracts, model, busy, sendDisabled, onSend, inputRef }: Props) {
  const { t } = useI18n();
  const inputId = useId();
  const { contractId, text, lossDate } = model.values;
  const canSend = model.canSend && !busy && !sendDisabled;
  const showCounter = text.length >= MAX_CLAIM_CHARS * COUNTER_VISIBLE_RATIO;
  useAutoGrow(inputRef, text);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSend) onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter while composing text with an input method confirms a character; it must not send.
    if (event.key !== KEY.ENTER || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <form className="composer" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId}>
        <VisuallyHidden>{t("form.claim")}</VisuallyHidden>
      </label>
      <TextArea
        id={inputId}
        ref={inputRef}
        className="composer__input"
        rows={1}
        placeholder={t("chat.placeholder")}
        value={text}
        maxLength={MAX_CLAIM_CHARS}
        onChange={(event) => model.setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="composer__bar">
        <ContractPicker contracts={contracts} value={contractId} onChange={model.setContractId} />
        <label className="composer__option">
          <span className="composer__caption">{t("form.lossDate")}</span>
          <TextInput
            type="date"
            className="composer__control"
            value={lossDate}
            max={todayIso()}
            onChange={(event) => model.setLossDate(event.target.value)}
          />
        </label>
        {showCounter && <span className="composer__caption">{t("form.counter", { n: text.length, max: MAX_CLAIM_CHARS })}</span>}
        <button type="submit" className="composer__send" disabled={!canSend} aria-label={t("form.submit")} title={t("form.submit")}>
          <ArrowUpIcon />
        </button>
      </div>
    </form>
  );
}
