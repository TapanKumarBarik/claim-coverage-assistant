import { useId, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { FieldContext } from "./fieldContext";
import "./Field.css";

interface Props {
  label: ReactNode;
  hint?: ReactNode;
  /** Secondary note under the control, right-aligned (for example a character counter). */
  meta?: ReactNode;
  error?: ReactNode;
  narrow?: boolean;
  /** The control to label: a TextInput, TextArea or Select. It picks up its id and ARIA wiring from here. */
  children: ReactNode;
}

/** A label, a control and its hint/error, wired together with matching ids. */
export function Field({ label, hint, meta, error, narrow = false, children }: Props) {
  const base = useId();
  const hintId = `${base}-hint`;
  const metaId = `${base}-meta`;
  const errorId = `${base}-error`;
  const describedBy = [hint && hintId, meta && metaId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("field", narrow && "field--narrow")}>
      <label htmlFor={base} className="label">
        {label}
      </label>
      <FieldContext.Provider value={{ id: base, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined }}>
        {children}
      </FieldContext.Provider>
      {hint && (
        <span id={hintId} className="field__note">
          {hint}
        </span>
      )}
      {meta && (
        <span id={metaId} className="field__note field__note--end">
          {meta}
        </span>
      )}
      {error && (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
