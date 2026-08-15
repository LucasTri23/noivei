'use client'

import Link from 'next/link'
import Spinner from '@/components/ui/spinner'
import { useVendorConversations } from '@/hooks/use-vendor-conversations'
import { formatMessageTimestamp } from '@/lib/vendor/format-message-timestamp'

interface VendorConversationsListProps {
  as:            'couple' | 'vendor'
  basePath:      string
  currentUserId: string
  emptyTitle:    string
  emptyBody:     string
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/**
 * Lista de conversas compartilhada entre casal e fornecedor — a diferença entre
 * os dois lados é só qual campo da linha (`vendor_business_name` vs.
 * `wedding_couple_names`) mostrar como "com quem" e pra onde o link aponta
 * (`basePath`), então unificar num componente parametrizado por `as` evita
 * duplicar a mesma UI de lista duas vezes.
 */
export default function VendorConversationsList({ as, basePath, currentUserId, emptyTitle, emptyBody }: VendorConversationsListProps) {
  const { data: conversations, isLoading, isError } = useVendorConversations(as)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Spinner size={22} color="var(--wedding-color)" />
      </div>
    )
  }

  if (isError) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px', padding: '32px 0' }}>
        Não foi possível carregar suas conversas. Tente recarregar a página.
      </p>
    )
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{
          padding: '56px 24px', borderRadius: 'var(--radius-lg)',
          background: 'var(--surface)', boxShadow: 'var(--shadow)',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: '52px', height: '52px', borderRadius: '16px', marginBottom: '16px',
            background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
          }}
        >
          <ChatIcon />
        </div>
        <h2 className="font-display" style={{ fontSize: '19px', fontWeight: 500, color: 'var(--fg)', margin: '0 0 6px' }}>
          {emptyTitle}
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', maxWidth: '360px', lineHeight: 1.6 }}>
          {emptyBody}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: '2px' }}>
      {conversations.map((conversation) => {
        const otherName = as === 'couple' ? conversation.vendor_business_name : conversation.wedding_couple_names
        const initial = (otherName || '?').charAt(0).toUpperCase()
        const hasUnread = conversation.unread_count > 0
        const previewPrefix = conversation.last_message_sender_user_id === currentUserId ? 'Você: ' : ''
        const preview = conversation.last_message_body ? `${previewPrefix}${conversation.last_message_body}` : 'Nenhuma mensagem ainda.'

        return (
          <Link
            key={conversation.id}
            href={`${basePath}/${conversation.id}`}
            className="flex items-center gap-3"
            style={{
              padding: '14px 12px', borderRadius: 'var(--radius-lg)',
              textDecoration: 'none', transition: 'background var(--duration-base, 0.15s) ease',
            }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
                fontWeight: 700, fontSize: '15px',
              }}
            >
              {initial}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: '14.5px', fontWeight: hasUnread ? 700 : 600, color: 'var(--fg)' }}>
                  {otherName}
                </span>
                {conversation.last_message_at && (
                  <span style={{ fontSize: '11.5px', color: 'var(--muted-fg)', flexShrink: 0 }}>
                    {formatMessageTimestamp(conversation.last_message_at)}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '2px 0 0', fontSize: '13px', color: hasUnread ? 'var(--fg)' : 'var(--muted-fg)',
                  fontWeight: hasUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preview}
              </p>
            </div>

            {hasUnread && (
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px',
                  background: 'var(--wedding-color)', color: '#fff', fontSize: '11px', fontWeight: 700,
                }}
              >
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
