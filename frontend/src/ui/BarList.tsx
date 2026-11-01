import "./BarList.css";

export interface BarItem {
  key: string;
  label: string;
  value: number;
}

interface Props {
  items: readonly BarItem[];
  /** Accessible name of the list. */
  label: string;
  formatValue?: (value: number) => string;
}

/**
 * Horizontal bars for comparing counts. The number is always printed next to its bar, so the
 * information never depends on seeing the bar (or its colour).
 */
export function BarList({ items, label, formatValue = String }: Props) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="bar-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className="bar-list__item">
          <span className="bar-list__label">{item.label}</span>
          <span className="bar-list__track" aria-hidden="true">
            <span className="bar-list__fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="bar-list__value">{formatValue(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}
