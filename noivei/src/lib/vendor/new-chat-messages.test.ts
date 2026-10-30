import { describe, expect, it } from 'vitest'
import { newUnreadConversations } from './new-chat-messages'
import type { VendorConversationListItem } from './vendor-conversation-types'
const row = { id: 'c1', last_message_at: '2026-10-30T13:00:00Z', last_message_sender_user_id: 'other', unread_count: 1 } as VendorConversationListItem
describe('avisos de novas mensagens', () => {
  it('não notifica histórico no primeiro carregamento nem repete a mesma mensagem', () => {
    expect(newUnreadConversations(null, [row], 'me')).toEqual([])
    expect(newUnreadConversations(new Map([['c1', row.last_message_at!]]), [row], 'me')).toEqual([])
  })
  it('notifica mensagem recebida e conversa nova, sem avisar mensagens próprias ou já lidas', () => {
    const previous = new Map([['c1', '2026-10-30T12:00:00Z']])
    expect(newUnreadConversations(previous, [row], 'me')).toEqual([row])
    expect(newUnreadConversations(new Map(), [row], 'me')).toEqual([row])
    expect(newUnreadConversations(previous, [{ ...row, last_message_sender_user_id: 'me' }], 'me')).toEqual([])
    expect(newUnreadConversations(previous, [{ ...row, unread_count: 0 }], 'me')).toEqual([])
  })
  it('não reenvia alerta se uma resposta antiga chegar depois', () => {
    expect(newUnreadConversations(new Map([['c1', '2026-10-30T14:00:00Z']]), [row], 'me')).toEqual([])
  })
})
