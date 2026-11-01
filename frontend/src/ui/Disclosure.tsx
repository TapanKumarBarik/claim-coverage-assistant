import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import "./Disclosure.css";

interface Props {
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A native `<details>`: keyboard operable and accessible without any script. */
export function Disclosure({ summary, className, children }: Props) {
  return (
    <details className={cx("disclosure", className)}>
      <summary>{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
