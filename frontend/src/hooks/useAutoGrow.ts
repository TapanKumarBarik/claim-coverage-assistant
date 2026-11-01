import { useLayoutEffect, type RefObject } from "react";

/** Makes a textarea as tall as its text. A CSS `max-height` caps it; beyond that it scrolls. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    if (element.scrollHeight > 0) element.style.height = `${element.scrollHeight}px`;
  }, [ref, value]);
}
