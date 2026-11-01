import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import "./ListBlock.css";

interface Props {
  title: ReactNode;
  items: readonly string[];
  className?: string;
  /** A small bold label instead of a heading, for lists nested inside another section. */
  compact?: boolean;
}

/** A title with a bulleted list; renders nothing when there are no items. */
export function ListBlock({ title, items, className, compact = false }: Props) {
  if (items.length === 0) return null;
  return (
    <section className={cx("list-block", compact && "list-block--compact", className)}>
      {compact ? <p className="label">{title}</p> : <h3>{title}</h3>}
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
