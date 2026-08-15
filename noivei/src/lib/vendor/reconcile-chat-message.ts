// Funções puras — nenhuma delas toca rede/estado do React, só reduzem uma lista
// de mensagens + um evento (envio otimista, resposta do POST, evento do Realtime)
// pra uma nova lista. Isolar essa lógica aqui (em vez de deixá-la espalhada dentro
// de callbacks do hook) é o que torna a corrida POST-vs-Realtime testável sem
// precisar de um browser/WebSocket de verdade — ver reconcile-chat-message.test.ts.

export type ChatMessageStatus = 'sending' | 'sent' | 'failed'

export interface ChatMessage {
  id:              string
  conversation_id: string
  sender_user_id:  string
  body:            string
  created_at:      string
  status:          ChatMessageStatus
}

/**
 * Adiciona uma mensagem otimista (id temporário, status 'sending') ao final da
 * lista — chamada em onMutate, antes do POST resolver.
 */
export function appendOptimisticMessage(messages: ChatMessage[], optimistic: ChatMessage): ChatMessage[] {
  return [...messages, optimistic]
}

/** Marca a mensagem otimista como falha (onError da mutation) — mantém na lista pra o usuário ver e poder reenviar, não some silenciosamente. */
export function markMessageFailed(messages: ChatMessage[], tempId: string): ChatMessage[] {
  return messages.map((message) => (message.id === tempId ? { ...message, status: 'failed' } : message))
}

/**
 * Reconcilia uma mensagem "confirmada" (id real, gerado pelo Postgres) contra o
 * estado local — chamada tanto pela resposta do POST de envio quanto pelo evento
 * `postgres_changes` do Realtime, então PRECISA ser idempotente e funcionar nas
 * duas ordens possíveis:
 *
 * Ordem A (POST resolve primeiro): a resposta do POST chama isto com a mensagem
 * real. Não existe ainda linha com esse `id` real na lista (só a otimista, com id
 * temporário) → cai no ramo 2, substitui a otimista mais antiga pendente. Quando
 * o evento do Realtime chega depois pra ESSA MESMA mensagem, `id` já bate
 * (ramo 1) → substitui a própria mensagem por ela mesma, sem duplicar.
 *
 * Ordem B (Realtime chega primeiro): o evento chama isto antes do POST resolver.
 * Não existe linha com esse `id` ainda (ramo 1 não bate) → cai no ramo 2 do mesmo
 * jeito, substitui a otimista pendente. Quando o POST resolve depois, `id` já
 * bate (ramo 1) → substitui por ela mesma, sem duplicar.
 *
 * Em ambas as ordens a otimista pendente mais ANTIGA (FIFO) é a substituída —
 * corresponde à ordem real de commit no Postgres/entrega do Realtime, e evita
 * depender do texto da mensagem bater (duas mensagens com o mesmo corpo enviadas
 * em sequência continuam corretas, já que a ordem de chegada é preservada).
 */
export function reconcileIncomingMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const byIdIndex = messages.findIndex((message) => message.id === incoming.id)
  if (byIdIndex !== -1) {
    const next = [...messages]
    next[byIdIndex] = { ...incoming, status: 'sent' }
    return next
  }

  const pendingIndex = messages.findIndex((message) => message.status === 'sending')
  if (pendingIndex !== -1) {
    const next = [...messages]
    next[pendingIndex] = { ...incoming, status: 'sent' }
    return next
  }

  // Mensagem genuinamente nova (do outro participante, ou nossa mas sem nenhuma
  // otimista pendente pra casar — ex.: Realtime entregando de novo após
  // reconexão) — insere na posição cronológica certa, não necessariamente no fim.
  const withIncoming = [...messages, { ...incoming, status: 'sent' as const }]
  return withIncoming.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/** Mescla uma página de mensagens mais antigas (paginação "carregar anteriores") no início da lista, sem duplicar por id. */
export function prependOlderMessages(messages: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
  const existingIds = new Set(messages.map((message) => message.id))
  const deduped = older.filter((message) => !existingIds.has(message.id))
  return [...deduped, ...messages]
}
