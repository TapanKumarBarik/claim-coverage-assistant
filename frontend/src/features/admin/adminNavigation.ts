import { createContext, useContext } from "react";

/** Where the admin area is looking, and how a component deep inside it sends the administrator somewhere else. */
export interface AdminNavigation {
  /** The conversation open in the Conversations tab, if any. */
  conversationId: string | null;
  /** Switch to the Conversations tab and open this one. */
  openConversation: (requestId: string) => void;
  /** Back to the conversation list. */
  closeConversation: () => void;
}

export const AdminNavigationContext = createContext<AdminNavigation | null>(null);

export function useAdminNavigation(): AdminNavigation {
  const navigation = useContext(AdminNavigationContext);
  if (!navigation) throw new Error("useAdminNavigation must be used inside the admin area");
  return navigation;
}
