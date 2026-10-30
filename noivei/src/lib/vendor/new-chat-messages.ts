import type { VendorConversationListItem } from './vendor-conversation-types'
export function newUnreadConversations(previous: Map<string, string> | null, current: VendorConversationListItem[], userId: string): VendorConversationListItem[] {
  if (!previous) return []
  return current.filter((conversation) => {
    if (!conversation.last_message_at || conversation.last_message_sender_user_id === userId || conversation.unread_count === 0) return false
    const seen = previous.get(conversation.id)
    return !seen || conversation.last_message_at > seen
  })
}
