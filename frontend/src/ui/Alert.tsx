import type { AriaRole, ReactNode } from "react";
import { TONE } from "../constants/tone";
import type { Tone } from "../constants/tone";
import { cx } from "../lib/cx";
import { TONE_CLASS } from "./tone";
import "./Alert.css";

interface Props {
  tone?: Tone;
  /** `alert` interrupts a screen reader; `status` waits politely. Defaults by tone. */
  role?: AriaRole;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Alert({ tone = TONE.INFO, role, title, className, children }: Props) {
  const resolvedRole = role ?? (tone === TONE.DANGER ? "alert" : "status");
  return (
    <div role={resolvedRole} className={cx("alert", TONE_CLASS[tone], className)}>
      {title && <p className="alert__title">{title}</p>}
      {children}
    </div>
  );
}
