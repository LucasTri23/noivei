// Verificação de segurança OBRIGATÓRIA da Fase 4 (chat em Realtime, primeira
// feature de Realtime deste projeto): prova, com DUAS sessões autenticadas de
// verdade (não um client mockado — Realtime não é testável de verdade sem um
// Postgres + Realtime server reais por trás, mesmo raciocínio de
// src/tests/rls/helpers.ts), que um usuário que NÃO participa de uma conversa
// nunca recebe o evento `postgres_changes` dela — mesmo sabendo (ou adivinhando/
// enumerando) o `conversation_id`, já que UUID não é segredo por design neste
// app. RLS é o que devia impedir isso; este teste existe porque "devia" não é
// prova.
//
// Requer um projeto Supabase local/de teste com Realtime habilitado (mesmo
// requisito de hasLiveSupabase() dos outros testes deste diretório) — sem isso,
// PULA (não falha), mesma disciplina do resto de src/tests/rls/.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createServiceClient, createTestUser, createTestVendor, createTestWedding,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// Tempo generoso o bastante pro round-trip real WAL -> Realtime -> WebSocket num
// ambiente de CI (costuma ser bem mais rápido que isso na prática), mas curto o
// bastante pra não deixar a suíte inteira lenta quando o teste É sobre "nunca
// chega" (esse caminho sempre espera o timeout inteiro, não tem como acelerar).
const SUBSCRIBE_TIMEOUT_MS = 10_000
const EVENT_WAIT_TIMEOUT_MS = 8_000

interface RawVendorMessageRow {
  id: string
  conversation_id: string
  body: string
}

function waitForSubscribed(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Canal não ficou SUBSCRIBED a tempo.')), SUBSCRIBE_TIMEOUT_MS)
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(err ?? new Error(`Falha ao inscrever no canal: ${status}`))
      }
    })
  })
}

/** Escuta UM evento INSERT em vendor_messages filtrado por conversationId — resolve com a linha recebida, ou com `null` se o timeout estourar antes de qualquer evento chegar (esse `null` É o resultado esperado no teste de não-participante). */
function listenForOneInsert(client: SupabaseClient<Database>, conversationId: string, channelName: string): {
  ready: Promise<void>
  result: Promise<RawVendorMessageRow | null>
  channel: RealtimeChannel
} {
  let resolveResult!: (value: RawVendorMessageRow | null) => void
  const result = new Promise<RawVendorMessageRow | null>((resolve) => { resolveResult = resolve })

  const channel = client.channel(channelName).on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'vendor_messages', filter: `conversation_id=eq.${conversationId}` },
    (payload) => resolveResult(payload.new as RawVendorMessageRow),
  )

  const ready = waitForSubscribed(channel)

  // Se nenhum evento chegar dentro do timeout, resolve com null (não deixa a
  // Promise pendurada pra sempre) — o teste decide se null é sucesso ou falha
  // dependendo de QUAL sessão está escutando.
  setTimeout(() => resolveResult(null), EVENT_WAIT_TIMEOUT_MS)

  return { ready, result, channel }
}

describe.skipIf(!hasLiveSupabase())('Realtime RLS — vendor_messages (postgres_changes)', () => {
  let service: SupabaseClient<Database>
  let coupleA: TestUser // parte da conversa (via módulo 'fornecedores' do casamento A)
  let coupleB: TestUser // dono de outro casamento, SEM relação com a conversa — tenta espiar sabendo o conversation_id
  let vendorV: TestUser // fornecedor parte da conversa

  let conversationId: string
  const channelsToCleanUp: RealtimeChannel[] = []

  beforeAll(async () => {
    service = createServiceClient()
    coupleA = await createTestUser(service, 'realtime-couple-a')
    coupleB = await createTestUser(service, 'realtime-couple-b')
    vendorV = await createTestUser(service, 'realtime-vendor-v')

    const weddingAId = await createTestWedding(service, coupleA.userId, 'Casamento Realtime A')
    await createTestWedding(service, coupleB.userId, 'Casamento Realtime B')
    const vendorVId = await createTestVendor(service, vendorV.userId)

    const { data: conv, error } = await service
      .from('vendor_conversations')
      .insert({ wedding_id: weddingAId, vendor_id: vendorVId, created_by: coupleA.userId })
      .select('id')
      .single()
    if (error || !conv) throw new Error(`Falha ao criar conversa de teste: ${error?.message}`)
    conversationId = (conv as { id: string }).id
  })

  afterAll(async () => {
    await Promise.all(channelsToCleanUp.map((channel) => service.removeChannel(channel)))
    await Promise.all([
      deleteTestUser(service, coupleA.userId),
      deleteTestUser(service, coupleB.userId),
      deleteTestUser(service, vendorV.userId),
    ])
  })

  it(
    'deve entregar o evento INSERT via Realtime para um PARTICIPANTE da conversa (casal A)',
    async () => {
      const listener = listenForOneInsert(coupleA.client, conversationId, `test-participant-${conversationId}`)
      channelsToCleanUp.push(listener.channel)
      await listener.ready

      const { error } = await service
        .from('vendor_messages')
        .insert({ conversation_id: conversationId, sender_user_id: vendorV.userId, body: 'Oi! Temos disponibilidade sim.' })
      expect(error).toBeNull()

      const received = await listener.result
      expect(received).not.toBeNull()
      expect(received?.conversation_id).toBe(conversationId)
      expect(received?.body).toBe('Oi! Temos disponibilidade sim.')
    },
    EVENT_WAIT_TIMEOUT_MS + SUBSCRIBE_TIMEOUT_MS,
  )

  it(
    // Este é O TESTE que a Fase 4 existe pra provar: casal B (autenticado de
    // verdade, sessão com JWT próprio, NÃO participante desta conversa) se
    // inscreve no MESMO conversation_id da conversa do casal A com o fornecedor V
    // — algo perfeitamente possível de fazer sabendo/adivinhando o UUID, já que
    // UUIDs não são segredo por design neste app. Se RLS não fosse avaliada pelo
    // servidor Realtime usando o JWT da conexão (ver
    // supabase/migrations/20260807000001_enable-realtime-vendor-messages.sql pro
    // raciocínio completo), este evento vazaria pro casal B. Ele NÃO deve chegar.
    'NÃO deve entregar o evento INSERT via Realtime para um casal que NÃO participa da conversa, mesmo sabendo o conversation_id',
    async () => {
      const listener = listenForOneInsert(coupleB.client, conversationId, `test-non-participant-${conversationId}`)
      channelsToCleanUp.push(listener.channel)
      await listener.ready

      const { error } = await service
        .from('vendor_messages')
        .insert({ conversation_id: conversationId, sender_user_id: coupleA.userId, body: 'Mensagem que o casal B nunca deveria ver.' })
      expect(error).toBeNull()

      const received = await listener.result
      expect(received).toBeNull()
    },
    EVENT_WAIT_TIMEOUT_MS + SUBSCRIBE_TIMEOUT_MS,
  )
})
