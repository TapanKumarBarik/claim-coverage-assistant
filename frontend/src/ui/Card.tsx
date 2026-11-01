import { useId, type ReactNode } from "react";
import { cx } from "../lib/cx";
import "./Card.css";
import "./VisuallyHidden.css";

interface Props {
  /** Heading; also names the card as a labelled region. */
  title?: ReactNode;
  /** Keep the heading for assistive technology but do not draw it. */
  hideTitle?: boolean;
  /** Heading level: `2` for a page-level card, `3` (default) for a card under a page heading. */
  level?: 2 | 3;
  narrow?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Card({ title, hideTitle = false, level = 3, narrow = false, className, children }: Props) {
  const headingId = useId();
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section className={cx("card", narrow && "card--narrow", className)} aria-labelledby={title ? headingId : undefined}>
      {title && (
        <Heading id={headingId} className={cx(hideTitle && "visually-hidden")}>
          {title}
        </Heading>
      )}
      {children}
    </section>
  );
}
