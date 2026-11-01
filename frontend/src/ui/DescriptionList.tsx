import type { ReactNode } from "react";
import "./DescriptionList.css";

export interface DescriptionItem {
  term: ReactNode;
  detail: ReactNode;
}

/** Term/detail pairs laid out in two columns (a connection summary, a checklist). */
export function DescriptionList({ items }: { items: readonly DescriptionItem[] }) {
  return (
    <dl className="description-list">
      {items.map((item, index) => (
        <div key={index} className="description-list__row">
          <dt>{item.term}</dt>
          <dd>{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
