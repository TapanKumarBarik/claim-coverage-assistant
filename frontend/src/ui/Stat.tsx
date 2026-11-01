import type { ReactNode } from "react";
import "./Stat.css";

/** A grid of key figures. Renders a description list: each `Stat` is a term and its value. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="stat-grid">{children}</dl>;
}

interface Props {
  label: ReactNode;
  /** The figure, or any element that carries it (a Pill, for example). */
  value: ReactNode;
  hint?: ReactNode;
}

export function Stat({ label, value, hint }: Props) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {hint && <dd className="stat__hint">{hint}</dd>}
    </div>
  );
}
