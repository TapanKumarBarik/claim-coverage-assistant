import { useContext } from "react";
import { I18nContext, type I18n } from "./I18nContext";

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
