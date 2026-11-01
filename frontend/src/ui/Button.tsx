import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../lib/cx";
import "./Button.css";

export type ButtonVariant = "secondary" | "primary" | "danger" | "dangerOutline" | "link" | "chip";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  secondary: "button--secondary",
  primary: "button--primary",
  danger: "button--danger",
  dangerOutline: "button--danger-outline",
  link: "button--link",
  chip: "button--chip",
};

interface Props extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  small?: boolean;
}

/** Defaults to `type="button"` so a button inside a form never submits it by accident. */
export function Button({ variant = "secondary", small = false, type = "button", className, ...rest }: Props) {
  return <button type={type} className={cx("button", VARIANT_CLASS[variant], small && "button--small", className)} {...rest} />;
}
