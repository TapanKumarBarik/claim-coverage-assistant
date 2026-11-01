import type { ComponentPropsWithoutRef } from "react";
import { TONE } from "../constants/tone";
import type { Tone } from "../constants/tone";
import { cx } from "../lib/cx";
import { TONE_CLASS } from "./tone";
import "./Pill.css";

interface Props extends ComponentPropsWithoutRef<"span"> {
  tone?: Tone;
}

/** A short status label. The text always carries the meaning; the tone only reinforces it. */
export function Pill({ tone = TONE.NEUTRAL, className, ...rest }: Props) {
  return <span className={cx("pill", TONE_CLASS[tone], className)} {...rest} />;
}
