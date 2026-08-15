import { describe, expect, it } from 'vitest'
import {
  appendOptimisticMessage, markMessageFailed, prependOlderMessages, reconcileIncomingMessage,
  type ChatMessage,
} from './reconcile-chat-message'

const USER_A = 'user-a'
const USER_B = 'user-b'
const CONVERSATION_ID = 'conv-1'

function optimistic(tempId: string, body: string): ChatMessage {
  return {
    id: tempId, conversation_id: CONVERSATION_ID, sender_user_id: USER_A,
    body, created_at: new Date().toISOString(), status: 'sending',
  }
}

function serverMessage(id: string, body: string, senderId = USER_A, createdAt = new Date().toISOString()): ChatMessage {
  return { id, conversation_id: CONVERSATION_ID, sender_user_id: senderId, body, created_at: createdAt, status: 'sent' }
}

describe('reconcileIncomingMessage', () => {
  describe('corrida POST-vs-Realtime: resposta do POST chega primeiro', () => {
    it('deve substituir a mensagem otimista pela confirmada quando o POST resolve, e não duplicar quando o Realtime chega depois pra a mesma mensagem', () => {
      const temp = optimistic('temp-1', 'Olá, gostaria de um orçamento.')
      let messages = appendOptimisticMessage([], temp)
      expect(messages).toHaveLength(1)
      expect(messages[0]!.status).toBe('sending')

      // 1) resposta do POST chega primeiro, com o id/created_at reais
      const confirmed = serverMessage('real-1', temp.body, USER_A)
      messages = reconcileIncomingMessage(messages, confirmed)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(confirmed)

      // 2) evento do Realtime chega depois, pra ESSA MESMA mensagem (o próprio
      // remetente também está inscrito no canal) — precisa ser um no-op idempotente,
      // não uma segunda linha
      messages = reconcileIncomingMessage(messages, confirmed)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(confirmed)
    })
  })

  describe('corrida POST-vs-Realtime: evento do Realtime chega primeiro', () => {
    it('deve substituir a mensagem otimista pela confirmada quando o Realtime chega primeiro, e não duplicar quando o POST resolve depois', () => {
      const temp = optimistic('temp-2', 'Vocês têm disponibilidade em março?')
      let messages = appendOptimisticMessage([], temp)

      // 1) o evento do Realtime chega ANTES da resposta do POST (ex.: latência do
      // fetch maior que o round-trip do WAL->Realtime)
      const confirmed = serverMessage('real-2', temp.body, USER_A)
      messages = reconcileIncomingMessage(messages, confirmed)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(confirmed)

      // 2) a resposta do POST chega depois, com a MESMA mensagem confirmada — não
      // pode duplicar nem "reverter" o status pra sending
      messages = reconcileIncomingMessage(messages, confirmed)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(confirmed)
    })
  })

  it('deve casar mensagens otimistas pendentes em ordem FIFO quando duas são enviadas em sequência antes de qualquer confirmação', () => {
    let messages = appendOptimisticMessage([], optimistic('temp-a', 'oi'))
    messages = appendOptimisticMessage(messages, optimistic('temp-b', 'tudo bem?'))
    expect(messages.map((m) => m.status)).toEqual(['sending', 'sending'])

    // A primeira a ser confirmada (independente de qual POST resolveu quando) deve
    // casar com a otimista mais ANTIGA ainda pendente, preservando a ordem.
    const firstConfirmed = serverMessage('real-a', 'oi')
    messages = reconcileIncomingMessage(messages, firstConfirmed)
    expect(messages[0]).toEqual(firstConfirmed)
    expect(messages[1]!.status).toBe('sending')

    const secondConfirmed = serverMessage('real-b', 'tudo bem?')
    messages = reconcileIncomingMessage(messages, secondConfirmed)
    expect(messages[0]).toEqual(firstConfirmed)
    expect(messages[1]).toEqual(secondConfirmed)
  })

  it('deve inserir uma mensagem nova do OUTRO participante (sem nenhuma otimista local pra casar) na posição cronológica certa', () => {
    const mine = serverMessage('real-1', 'Oi!', USER_A, '2026-08-13T10:00:00.000Z')
    const theirs = serverMessage('real-2', 'Olá, em que posso ajudar?', USER_B, '2026-08-13T10:01:00.000Z')

    let messages = reconcileIncomingMessage([], mine)
    messages = reconcileIncomingMessage(messages, theirs)

    expect(messages.map((m) => m.id)).toEqual(['real-1', 'real-2'])
  })

  it('não deve descartar uma mensagem entregue duas vezes pelo Realtime (reconexão) mesmo sem otimista pendente', () => {
    const message = serverMessage('real-3', 'Confirmado para sábado.', USER_B)
    let messages = reconcileIncomingMessage([], message)
    messages = reconcileIncomingMessage(messages, message) // entrega duplicada
    expect(messages).toHaveLength(1)
  })
})

describe('markMessageFailed', () => {
  it('deve marcar a mensagem otimista como failed sem removê-la (usuário precisa poder ver/reenviar)', () => {
    const messages = appendOptimisticMessage([], optimistic('temp-1', 'oi'))
    const result = markMessageFailed(messages, 'temp-1')
    expect(result).toHaveLength(1)
    expect(result[0]!.status).toBe('failed')
  })
})

describe('prependOlderMessages', () => {
  it('deve inserir mensagens antigas no início sem duplicar as que já existem na lista', () => {
    const current = [serverMessage('m2', 'segunda', USER_A, '2026-08-13T10:01:00.000Z')]
    const older = [
      serverMessage('m1', 'primeira', USER_A, '2026-08-13T10:00:00.000Z'),
      serverMessage('m2', 'segunda', USER_A, '2026-08-13T10:01:00.000Z'), // sobreposição de página
    ]

    const result = prependOlderMessages(current, older)
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})
