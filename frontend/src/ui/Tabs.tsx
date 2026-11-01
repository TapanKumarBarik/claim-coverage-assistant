import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { KEY } from "../constants/keys";
import { cx } from "../lib/cx";
import "./Tabs.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Controls shown at the end of the tab bar (a sign-out button, a status line). */
  actions?: ReactNode;
  /** `secondary` is the quieter underline style for tabs inside another tab's panel. */
  variant?: "primary" | "secondary";
  /** Content of the selected tab. */
  children: ReactNode;
}

const KEY_STEP: Record<string, number> = { [KEY.ARROW_RIGHT]: 1, [KEY.ARROW_LEFT]: -1 };

/** WAI-ARIA tabs: one tab stop, arrow keys / Home / End move between tabs, the panel is labelled by its tab. */
export function Tabs<T extends string>({ label, tabs, value, onChange, actions, variant = "primary", children }: Props<T>) {
  const base = useId();
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const tabId = (id: T) => `${base}-tab-${id}`;
  const panelId = (id: T) => `${base}-panel-${id}`;

  function move(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = index;
    if (event.key in KEY_STEP) next = (index + (KEY_STEP[event.key] ?? 0) + tabs.length) % tabs.length;
    else if (event.key === KEY.HOME) next = 0;
    else if (event.key === KEY.END) next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onChange(target.id);
    buttons.current.get(target.id)?.focus();
  }

  return (
    <div className={cx("tabs", variant === "secondary" && "tabs--secondary")}>
      <div className="tabs__bar">
        <div role="tablist" aria-label={label} className="tabs__list" onKeyDown={move}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className="tabs__tab"
              aria-selected={tab.id === value}
              aria-controls={panelId(tab.id)}
              tabIndex={tab.id === value ? 0 : -1}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {actions && <div className="tabs__actions">{actions}</div>}
      </div>
      <div role="tabpanel" id={panelId(value)} aria-labelledby={tabId(value)} className="tabs__panel">
        {children}
      </div>
    </div>
  );
}
