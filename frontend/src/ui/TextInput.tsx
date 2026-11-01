import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../lib/cx";
import { useFieldControlProps } from "./fieldContext";
import "./control.css";

export function TextInput({ className, ...rest }: ComponentPropsWithoutRef<"input">) {
  const field = useFieldControlProps();
  return <input className={cx("control", className)} {...field} {...rest} />;
}
