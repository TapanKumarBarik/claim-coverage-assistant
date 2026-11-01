import type { ReactNode } from "react";
import { I18nProvider } from "../i18n/I18nProvider";
import { SessionProvider } from "../features/session/SessionProvider";

/** Everything the whole app shares: the language, and which AI credentials this browser session uses. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <SessionProvider>{children}</SessionProvider>
    </I18nProvider>
  );
}
