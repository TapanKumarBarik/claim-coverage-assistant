import { useAdminNavigation } from "../adminNavigation";
import { ConversationDetailView } from "./ConversationDetailView";
import { ConversationList } from "./ConversationList";

/** The "Conversations" tab: the list, or one conversation opened from it (or from a request in AI governance). */
export function ConversationsTab() {
  const { conversationId, openConversation, closeConversation } = useAdminNavigation();
  return conversationId === null ? (
    <ConversationList onOpen={openConversation} />
  ) : (
    <ConversationDetailView requestId={conversationId} onBack={closeConversation} />
  );
}
