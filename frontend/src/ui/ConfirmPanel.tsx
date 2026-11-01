import type { ReactNode } from "react";
import { Button } from "./Button";
import "./ConfirmPanel.css";

interface Props {
  /** Accessible name of the dialog, for example the action being confirmed. */
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Draws the confirm button as a destructive action. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** An inline "are you sure?" step. Nothing happens until the user confirms. */
export function ConfirmPanel({ title, message, confirmLabel, cancelLabel, destructive = false, busy = false, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-panel" role="alertdialog" aria-label={title}>
      <p>{message}</p>
      <div className="row">
        <Button variant={destructive ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onClick={onCancel}>{cancelLabel}</Button>
      </div>
    </div>
  );
}
