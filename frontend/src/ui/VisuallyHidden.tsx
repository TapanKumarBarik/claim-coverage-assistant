import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../lib/cx";
import "./VisuallyHidden.css";

/** Text for assistive technology only (still read aloud, not drawn). */
export function VisuallyHidden({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span className={cx("visually-hidden", className)} {...rest} />;
}
