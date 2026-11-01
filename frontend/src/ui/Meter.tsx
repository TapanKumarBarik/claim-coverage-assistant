import { useId, type ReactNode } from "react";
import { TONE, type Tone } from "../constants/tone";
import { cx } from "../lib/cx";
import { TONE_CLASS } from "./tone";
import "./Meter.css";

interface Props {
  label: ReactNode;
  value: number;
  max: number;
  /** The figures in words, for the right of the label and for assistive technology. */
  valueText: string;
  /** The bar changes colour with the tone; the text always carries the meaning. */
  tone?: Tone;
  hint?: ReactNode;
}

/** One labelled gauge: how much of a limit is used. */
export function Meter({ label, value, max, valueText, tone = TONE.OK, hint }: Props) {
  const labelId = useId();
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={cx("meter", TONE_CLASS[tone])}>
      <div className="meter__head">
        <span id={labelId} className="meter__label">
          {label}
        </span>
        <span className="meter__value">{valueText}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-valuetext={valueText}
      >
        <span className="meter__fill" style={{ width: `${share * 100}%` }} />
      </div>
      {hint && <p className="meter__hint">{hint}</p>}
    </div>
  );
}
