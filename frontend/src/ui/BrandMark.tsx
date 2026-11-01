import { cx } from "../lib/cx";
import { AssistantIcon } from "./icons";
import "./BrandMark.css";

/** The product's mark: a shield with a tick on the brand gradient. Decorative; the name beside it is the label. */
export function BrandMark({ size = "small" }: { size?: "small" | "large" }) {
  const pixels = size === "large" ? 30 : 18;
  return (
    <span className={cx("brand-mark", size === "large" && "brand-mark--large")}>
      <AssistantIcon width={pixels} height={pixels} />
    </span>
  );
}
