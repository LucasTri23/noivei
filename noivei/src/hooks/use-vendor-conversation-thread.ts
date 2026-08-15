'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import {
  appendOptimisticMessage, markMessageFailed, prependOlderMessages, reconcileIncomingMessage,
  type ChatMessage, type ChatMessageStatus,
} from '@/lib/vendor/reconcile-chat-message'

interface RawVendorMessage {
  id:              string
  conversation_id: string
  sender_user_id:  string
  body:            string
  created_at:      string
  deleted_at:      string | null
}

interface MessagesApiResponse {
  data: RawVendorMessage[]
  meta: { hasMore: boolean; nextCursor: string | null }
}

// Query keys centralizadas no próprio arquivo do hook, convenção de CLAUDE.md.
const keys = {
  messages: (conversationId: string) => ['vendor-conversations', conversationId, 'messages'] as const,
}

function toChatMessage(row: RawVendorMessage, status: ChatMessageStatus = 'sent'): ChatMessage {
  return {
    id: row.id, conversation_id: row.conversation_id, sender_user_id: row.sender_user_id,
    body: row.body, created_at: row.created_at, status,
  }
}

async function fetchMessages(conversationId: string, before?: string): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const url = new URL(`/api/v1/vendor-conversations/${conversationId}/messages`, window.location.origin)
  if (before) url.searchParams.set('before', before)

  const res = await fetch(url, { cache: 'no-store' })
  const body = (await res.json()) as MessagesApiResponse & { error?: { message: string } }
  if (!res.ok) throw new Error(body.error?.message ?? 'Erro ao carregar mensagens.')

  return { messages: body.data.map((row) => toChatMessage(row)), hasMore: body.meta.hasMore }
}

/**
 * Estado + Realtime de UMA conversa aberta — usado pelo componente de thread
 * compartilhado entre casal e fornecedor (ver
 * src/components/vendors/chat/vendor-message-thread.tsx). TanStack Query é a
 * camada de cache (`keys.messages`); o evento do Realtime e a resposta do POST de
 * envio convergem pro MESMO cache via `reconcileIncomingMessage` — ver
 * src/lib/vendor/reconcile-chat-message.ts pro raciocínio completo da corrida
 * entre as duas ordens de chegada possíveis.
 */
export function useVendorConversationThread(conversationId: string, currentUserId: string) {
  const queryClient = useQueryClient()
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  // Evita disparar um refetch redundante logo na primeira vez que o canal fica
  // SUBSCRIBED (já coberto pelo fetch inicial da query) — só refaz o fetch quando
  // o canal RE-conecta depois de ter caído (CLOSED/CHANNEL_ERROR/TIMED_OUT).
  const hasSubscribedOnceRef = useRef(false)

  const messagesQuery = useQuery({
    queryKey: keys.messages(conversationId),
    queryFn: async () => {
      const { messages, hasMore } = await fetchMessages(conversationId)
      setHasMoreOlder(hasMore)
      return messages
    },
  })

  useEffect(() => {
    const supabase = createSupabaseBrowser()

    // Autorização de verdade é a RLS avaliada pelo servidor Realtime com o JWT
    // desta sessão (RealtimeClient.setAuth, propagado automaticamente pelo
    // SupabaseClient a cada SIGNED_IN/TOKEN_REFRESHED — ver comentário completo em
    // supabase/migrations/20260807000001_enable-realtime-vendor-messages.sql). O
    // `filter` abaixo é só uma otimização (não processar eventos de outras
    // conversas no client), NÃO é a fronteira de segurança — mesmo sem ele, RLS já
    // impede o evento de chegar pra quem não é participante desta conversa.
    const channel = supabase
      .channel(`vendor-messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vendor_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = toChatMessage(payload.new as RawVendorMessage)
          queryClient.setQueryData<ChatMessage[]>(keys.messages(conversationId), (old = []) =>
            reconcileIncomingMessage(old, row),
          )
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribedOnceRef.current) {
            // Fallback explicitamente pedido pelo dono do produto: o canal caiu e
            // reconectou — não confiar que nenhuma mensagem foi perdida enquanto
            // desconectado, refaz o fetch da conversa aberta em vez de só confiar
            // no próximo evento que chegar.
            queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) })
          }
          hasSubscribedOnceRef.current = true
        }
      })

    return () => {
      hasSubscribedOnceRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])

  // Fallback pedido pelo dono do produto: refetch quando a aba volta a ficar
  // visível depois de em segundo plano — não confiar que o socket entregou tudo
  // enquanto a aba estava em background (mobile Safari/Chrome throttlam/matam
  // conexões de aba em segundo plano). Complementa (não substitui) o
  // `refetchOnWindowFocus` padrão do TanStack Query (ver query-provider.tsx).
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [conversationId, queryClient])

  const sendMutation = useMutation({
    mutationFn: async (body: string): Promise<ChatMessage> => {
      const res = await fetch(`/api/v1/vendor-conversations/${conversationId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      })
      const responseBody = await res.json()
      if (!res.ok) throw new Error(responseBody?.error?.message ?? 'Erro ao enviar mensagem.')
      return toChatMessage(responseBody.data as RawVendorMessage)
    },
    // Otimista: mostra a mensagem imediatamente com status 'sending' — adaptado do
    // padrão onMutate/onError de CLAUDE.md (lá é um toggle idempotente; aqui é um
    // append que depois precisa CONVERGIR com o evento do Realtime pro mesmo id,
    // não só reverter em caso de erro).
    onMutate: async (body: string) => {
      await queryClient.cancelQueries({ queryKey: keys.messages(conversationId) })

      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: ChatMessage = {
        id: tempId, conversation_id: conversationId, sender_user_id: currentUserId,
        body, created_at: new Date().toISOString(), status: 'sending',
      }
      queryClient.setQueryData<ChatMessage[]>(keys.messages(conversationId), (old = []) =>
        appendOptimisticMessage(old, optimistic),
      )

      return { tempId }
    },
    onSuccess: (confirmed) => {
      queryClient.setQueryData<ChatMessage[]>(keys.messages(conversationId), (old = []) =>
        reconcileIncomingMessage(old, confirmed),
      )
    },
    onError: (_error, _body, context) => {
      if (!context) return
      queryClient.setQueryData<ChatMessage[]>(keys.messages(conversationId), (old = []) =>
        markMessageFailed(old, context.tempId),
      )
    },
  })

  const loadOlder = useCallback(async () => {
    const current = queryClient.getQueryData<ChatMessage[]>(keys.messages(conversationId)) ?? []
    const oldest = current[0]
    if (!oldest || isLoadingOlder) return

    setIsLoadingOlder(true)
    try {
      const { messages: older, hasMore } = await fetchMessages(conversationId, oldest.created_at)
      queryClient.setQueryData<ChatMessage[]>(keys.messages(conversationId), (old = []) =>
        prependOlderMessages(old, older),
      )
      setHasMoreOlder(hasMore)
    } catch {
      // Melhor esforço — falha ao carregar mensagens mais antigas não derruba o
      // thread atual, só deixa o botão "carregar mais" disponível pra tentar de novo.
    } finally {
      setIsLoadingOlder(false)
    }
  }, [conversationId, isLoadingOlder, queryClient])

  const markRead = useCallback(() => {
    void fetch(`/api/v1/vendor-conversations/${conversationId}/read`, { method: 'POST' })
  }, [conversationId])

  return {
    messages:      messagesQuery.data ?? [],
    isLoading:     messagesQuery.isPending,
    isError:       messagesQuery.isError,
    hasMoreOlder,
    isLoadingOlder,
    loadOlder,
    sendMessage:   sendMutation.mutate,
    isSending:     sendMutation.isPending,
    markRead,
  }
}
