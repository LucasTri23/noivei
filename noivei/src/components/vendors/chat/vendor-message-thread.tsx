'use client'

import Link from 'next/link'
import VendorAvatar from '@/components/vendors/vendor-avatar'
import { useEffect, useRef, useState } from 'react'
import Spinner from '@/components/ui/spinner'
import { useVendorConversationThread } from '@/hooks/use-vendor-conversation-thread'
import { formatMessageTimestamp } from '@/lib/vendor/format-message-timestamp'
import type { ChatMessage } from '@/lib/vendor/reconcile-chat-message'

interface VendorMessageThreadProps {
  avatarUrl?: string
  conversationId: string
  currentUserId:  string
  otherPartyName: string
  backHref:       string
}

const MESSAGE_MAX_LENGTH = 4000

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function MessageBubble({ message, isMine, onRetry }: { message: ChatMessage; isMine: boolean; onRetry: (message: ChatMessage) => void }) {
  const isFailed = message.status === 'failed'

  return (
    <div className="flex" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        <button
          type="button"
          onClick={() => isFailed && onRetry(message)}
          disabled={!isFailed}
          style={{
            textAlign: 'left',
            border: isFailed ? '1px solid var(--color-error)' : 'none',
            cursor: isFailed ? 'pointer' : 'default',
            padding: '10px 14px',
            borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: isFailed
              ? 'color-mix(in srgb, var(--color-error) 10%, transparent)'
              : isMine
                ? 'var(--wedding-color)'
                : 'var(--surface)',
            color: isFailed ? 'var(--fg)' : isMine ? '#fff' : 'var(--fg)',
            boxShadow: isMine ? 'none' : 'var(--shadow-sm)',
            opacity: message.status === 'sending' ? 0.65 : 1,
            fontSize: '14.5px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.body}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', padding: '0 4px' }}>
          {message.status === 'sending' && <Spinner size={10} color="var(--muted-fg)" />}
          {isFailed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-error)', fontSize: '11px' }}>
              <RetryIcon /> Falha ao enviar — toque para tentar de novo
            </span>
          )}
          {!isFailed && (
            <span style={{ fontSize: '11px', color: 'var(--muted-fg)' }}>
              {formatMessageTimestamp(message.created_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Thread de mensagens compartilhado entre casal e fornecedor — a única diferença
 * entre os dois lados é qual `conversationId`/`otherPartyName`/`backHref` a página
 * chamadora passa; toda a lógica de bolha/composer/envio/Realtime é a mesma. Texto
 * da mensagem é SEMPRE renderizado como texto simples via interpolação JSX
 * (`{message.body}` acima) — NUNCA `dangerouslySetInnerHTML` neste componente nem
 * em nenhum outro do chat, é a primeira vez que texto livre de um usuário é
 * renderizado na tela de OUTRO usuário neste app.
 */
export default function VendorMessageThread({ conversationId, currentUserId, otherPartyName, backHref, avatarUrl }: VendorMessageThreadProps) {
  const {
    messages, isLoading, isError, hasMoreOlder, isLoadingOlder, loadOlder,
    sendMessage, isSending, markRead,
  } = useVendorConversationThread(conversationId, currentUserId)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasScrolledInitiallyRef = useRef(false)

  // Rola pro fim (comportamento instantâneo na primeira carga, suave depois) e
  // marca como lida sempre que a lista de mensagens muda — cobre tanto uma
  // mensagem nova chegando via Realtime quanto o envio de uma própria.
  useEffect(() => {
    if (messages.length === 0) return
    const container = scrollRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: hasScrolledInitiallyRef.current ? 'smooth' : 'auto' })
      hasScrolledInitiallyRef.current = true
    }
    if (document.visibilityState === 'visible') markRead()
  }, [messages, markRead])

  function handleSend() {
    const body = draft.trim()
    if (!body || body.length > MESSAGE_MAX_LENGTH) return
    setDraft('')
    sendMessage(body)
  }

  function handleRetry(message: ChatMessage) {
    sendMessage(message.body)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: '0' }}>
      <div
        className="flex items-center gap-3"
        style={{ padding: '4px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}
      >
        <Link
          href={backHref}
          aria-label="Voltar para conversas"
          className="md:hidden"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '50%',
            color: 'var(--muted-fg)', flexShrink: 0,
          }}
        >
          <BackIcon />
        </Link>
        <VendorAvatar name={otherPartyName} src={avatarUrl} size={40} />
        <h1 className="font-display" style={{ fontSize: '19px', fontWeight: 500, color: 'var(--fg)', margin: 0 }}>
          {otherPartyName}
        </h1>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}
      >
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner size={20} color="var(--wedding-color)" />
          </div>
        )}

        {isError && !isLoading && (
          <p style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: '13.5px', padding: '24px 0' }}>
            Não foi possível carregar as mensagens. Tente recarregar a página.
          </p>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: '13.5px', padding: '24px 0' }}>
            Envie a primeira mensagem para começar a conversa.
          </p>
        )}

        {!isLoading && hasMoreOlder && messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
            <button
              type="button"
              onClick={loadOlder}
              disabled={isLoadingOlder}
              style={{
                fontSize: '12.5px', fontWeight: 600, color: 'var(--wedding-color-dark)',
                background: 'var(--wedding-color-subtle)', border: 'none', borderRadius: '999px',
                padding: '6px 14px', cursor: isLoadingOlder ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              {isLoadingOlder && <Spinner size={11} />}
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.sender_user_id === currentUserId}
            onRetry={handleRetry}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          maxLength={MESSAGE_MAX_LENGTH}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: '11px 14px', fontSize: '14.5px', fontFamily: 'var(--font-body)', color: 'var(--fg)',
            background: 'var(--surface)', minHeight: '44px', maxHeight: '140px', lineHeight: 1.4,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          aria-label="Enviar mensagem"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: '44px', height: '44px', borderRadius: 'var(--radius-lg)', border: 'none',
            background: draft.trim() ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
            color: draft.trim() ? '#fff' : 'var(--wedding-color-dark)',
            cursor: draft.trim() ? 'pointer' : 'default',
          }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
