import type { Language } from "../api/types";
import { MS_PER_SECOND } from "../constants/limits";
import type { Translate } from "./translate";

const LOCALE: Record<Language, string> = { en: "en-GB", fr: "fr-LU" };
const DATE_ONLY_LENGTH = "YYYY-MM-DD".length;

export interface Formatters {
  /** `2026-11-01` or an ISO timestamp, as a medium date. Unparseable input is returned unchanged. */
  date(iso: string): string;
  dateTime(iso: string): string;
  number(value: number): string;
  /** A ratio between 0 and 1 as a percentage. */
  percent(ratio: number): string;
  /** Milliseconds as "850 ms" or "1.8 s". */
  duration(ms: number): string;
  /** Seconds as "30 s". */
  seconds(value: number): string;
}

export function createFormatters(lang: Language, t: Translate): Formatters {
  const locale = LOCALE[lang];
  const numberFormat = new Intl.NumberFormat(locale);
  const decimalFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percentFormat = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const dateTimeFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" });

  const parse = (iso: string) => new Date(iso.length === DATE_ONLY_LENGTH ? `${iso}T00:00:00` : iso);

  return {
    date: (iso) => {
      const date = parse(iso);
      return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
    },
    dateTime: (iso) => {
      const date = parse(iso);
      return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
    },
    number: (value) => numberFormat.format(value),
    percent: (ratio) => percentFormat.format(ratio),
    duration: (ms) =>
      ms < MS_PER_SECOND
        ? t("unit.milliseconds", { n: numberFormat.format(Math.round(ms)) })
        : t("unit.seconds", { n: decimalFormat.format(ms / MS_PER_SECOND) }),
    seconds: (value) => t("unit.seconds", { n: numberFormat.format(value) }),
  };
}
