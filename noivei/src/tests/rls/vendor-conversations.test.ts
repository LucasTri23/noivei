// RLS: vendor_conversations / vendor_messages — a primeira RLS de DOIS LADOS deste
// projeto (acesso resolvido pelo lado do CASAL via fn_has_module_access OU pelo
// lado do FORNECEDOR via fn_owns_vendor, nunca só um). Ver
// supabase/migrations/20260806000004_create-vendor-marketplace-chat.sql.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createServiceClient, createTestUser, createTestVendor, createTestWedding,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// createServiceClient() só roda dentro de beforeAll — ver comentário em
// vendor-profiles.test.ts (corpo do describe executa mesmo em suítes puladas).
describe.skipIf(!hasLiveSupabase())('RLS vendor_conversations / vendor_messages', () => {
  let service: SupabaseClient<Database>
  let coupleA: TestUser  // dono do casamento A, parte da conversa
  let coupleB: TestUser  // dono do casamento B, SEM relação com a conversa
  let vendorV: TestUser  // fornecedor parte da conversa
  let vendorW: TestUser  // fornecedor SEM relação com a conversa

  let weddingAId: string
  let vendorVId: string
  let conversationId: string
  let messageId: string

  beforeAll(async () => {
    service = createServiceClient()
    coupleA = await createTestUser(service, 'couple-a')
    coupleB = await createTestUser(service, 'couple-b')
    vendorV = await createTestUser(service, 'vendor-v')
    vendorW = await createTestUser(service, 'vendor-w')

    weddingAId = await createTestWedding(service, coupleA.userId, 'Casamento A')
    await createTestWedding(service, coupleB.userId, 'Casamento B')
    vendorVId  = await createTestVendor(service, vendorV.userId)
    await createTestVendor(service, vendorW.userId)

    const { data: conv, error: convError } = await service
      .from('vendor_conversations')
      .insert({ wedding_id: weddingAId, vendor_id: vendorVId, created_by: coupleA.userId })
      .select('id')
      .single()
    if (convError || !conv) throw new Error(`Falha ao criar conversa de teste: ${convError?.message}`)
    conversationId = (conv as { id: string }).id

    const { data: msg, error: msgError } = await service
      .from('vendor_messages')
      .insert({ conversation_id: conversationId, sender_user_id: coupleA.userId, body: 'Olá, gostaria de um orçamento.' })
      .select('id')
      .single()
    if (msgError || !msg) throw new Error(`Falha ao criar mensagem de teste: ${msgError?.message}`)
    messageId = (msg as { id: string }).id
  })

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(service, coupleA.userId),
      deleteTestUser(service, coupleB.userId),
      deleteTestUser(service, vendorV.userId),
      deleteTestUser(service, vendorW.userId),
    ])
  })

  it('deve permitir que o casal A (parte da conversa) leia a própria conversa e mensagens', async () => {
    const { data: conv } = await coupleA.client.from('vendor_conversations').select('id').eq('id', conversationId)
    expect(conv).toEqual([{ id: conversationId }])

    const { data: msgs } = await coupleA.client.from('vendor_messages').select('id').eq('id', messageId)
    expect(msgs).toEqual([{ id: messageId }])
  })

  it('deve permitir que o fornecedor V (parte da conversa) leia a própria conversa e mensagens', async () => {
    const { data: conv } = await vendorV.client.from('vendor_conversations').select('id').eq('id', conversationId)
    expect(conv).toEqual([{ id: conversationId }])

    const { data: msgs } = await vendorV.client.from('vendor_messages').select('id').eq('id', messageId)
    expect(msgs).toEqual([{ id: messageId }])
  })

  it('não deve permitir que membros do casamento B leiam a conversa do casamento A', async () => {
    const { data, error } = await coupleB.client.from('vendor_conversations').select('id').eq('id', conversationId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que membros do casamento B leiam as mensagens da conversa do casamento A', async () => {
    const { data, error } = await coupleB.client.from('vendor_messages').select('id').eq('id', messageId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que um fornecedor sem relação com a conversa (W) leia suas mensagens', async () => {
    const { data, error } = await vendorW.client.from('vendor_messages').select('id').eq('id', messageId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que o casamento B insira mensagem numa conversa que não é sua', async () => {
    const { data, error } = await coupleB.client
      .from('vendor_messages')
      .insert({ conversation_id: conversationId, sender_user_id: coupleB.userId, body: 'Invasão' })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  // Defesa em profundidade: mesmo o casal A (que TEM acesso à conversa) não pode
  // forjar sender_user_id de outra pessoa — WITH CHECK exige sender_user_id = auth.uid()
  // independente da rota de API (fase futura) confiar ou não no campo do body.
  it('não deve permitir que o casal A insira mensagem se fizer de conta que é outra pessoa (sender_user_id forjado)', async () => {
    const { data, error } = await coupleA.client
      .from('vendor_messages')
      .insert({ conversation_id: conversationId, sender_user_id: vendorV.userId, body: 'Forjado' })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('deve manter first_message_at/last_message_at sincronizados via trigger ao inserir mensagem', async () => {
    const { error } = await coupleA.client
      .from('vendor_messages')
      .insert({ conversation_id: conversationId, sender_user_id: coupleA.userId, body: 'Segunda mensagem' })
    expect(error).toBeNull()

    const { data: conv } = await service
      .from('vendor_conversations')
      .select('first_message_at, last_message_at')
      .eq('id', conversationId)
      .single()
    const row = conv as { first_message_at: string | null; last_message_at: string | null } | null
    expect(row?.first_message_at).not.toBeNull()
    expect(row?.last_message_at).not.toBeNull()
  })
})
