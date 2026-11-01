import type { ComponentPropsWithRef } from "react";
import { cx } from "../lib/cx";
import { useFieldControlProps } from "./fieldContext";
import "./control.css";

/** `ref` is an ordinary prop in React 19, so callers can focus or measure the box. */
export function TextArea({ className, ...rest }: ComponentPropsWithRef<"textarea">) {
  const field = useFieldControlProps();
  return <textarea className={cx("control", className)} {...field} {...rest} />;
}
