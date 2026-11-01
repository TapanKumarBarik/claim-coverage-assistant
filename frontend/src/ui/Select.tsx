import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../lib/cx";
import { useFieldControlProps } from "./fieldContext";
import "./control.css";

export function Select({ className, ...rest }: ComponentPropsWithoutRef<"select">) {
  const field = useFieldControlProps();
  return <select className={cx("control", className)} {...field} {...rest} />;
}
