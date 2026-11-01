import type { ReactNode } from "react";
import "./EmptyState.css";

/** "Nothing here" message, optionally with a next step. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
