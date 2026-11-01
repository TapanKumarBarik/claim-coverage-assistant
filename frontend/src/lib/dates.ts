import { MS_PER_MINUTE } from "../constants/limits";

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date in the browser's time zone, as `YYYY-MM-DD` (what `<input type="date">` expects). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole minutes from `now` until `iso`, at least 1. `null` when the time is missing or unparseable. */
export function minutesUntil(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(1, Math.ceil((target - now) / MS_PER_MINUTE));
}
