// RLS: portfólio e tabelas de cobrança do fornecedor (vendor_portfolio_items,
// vendor_subscriptions, vendor_payment_checkouts) — isolamento entre fornecedores.
// vendor_subscriptions continua sem NENHUMA policy de INSERT/UPDATE pra
// `authenticated` (toda escrita é service role / webhook / fn_redeem_vendor_coupon,
// ver 20260806000003). vendor_payment_checkouts passou a aceitar INSERT/UPDATE do
// PRÓPRIO fornecedor a partir de 20260831000003 (Fase 5: a rota de checkout precisa
// gravar com o client autenticado normal) — os testes abaixo cobrem que isso
// continua restrito à própria linha (fn_owns_vendor), não vira um IDOR novo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createServiceClient, createTestUser, createTestVendor,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// createServiceClient() só roda dentro de beforeAll — ver comentário em
// vendor-profiles.test.ts (corpo do describe executa mesmo em suítes puladas).
describe.skipIf(!hasLiveSupabase())('RLS vendor_portfolio_items / vendor_subscriptions / vendor_payment_checkouts', () => {
  let service: SupabaseClient<Database>
  let vendorA: TestUser
  let vendorB: TestUser
  let vendorAId: string
  let vendorBId: string
  let portfolioItemBId: string

  beforeAll(async () => {
    service = createServiceClient()
    vendorA = await createTestUser(service, 'vendor-a')
    vendorB = await createTestUser(service, 'vendor-b')
    vendorAId = await createTestVendor(service, vendorA.userId)
    vendorBId = await createTestVendor(service, vendorB.userId)

    const { data: item, error: itemError } = await service
      .from('vendor_portfolio_items')
      .insert({ vendor_id: vendorBId, storage_path: `${vendorBId}/foto.jpg` })
      .select('id')
      .single()
    if (itemError || !item) throw new Error(`Falha ao criar item de portfólio: ${itemError?.message}`)
    portfolioItemBId = (item as { id: string }).id

    await service.from('vendor_subscriptions').insert({ vendor_id: vendorBId, plan_id: 'vendor_monthly', status: 'active' })
    await service.from('vendor_payment_checkouts').insert({
      vendor_id: vendorBId, vendor_plan_id: 'vendor_monthly',
      mp_reference: `test-ref-${crypto.randomUUID()}`, amount_cents: 2000,
    })
  })

  afterAll(async () => {
    await deleteTestUser(service, vendorA.userId)
    await deleteTestUser(service, vendorB.userId)
  })

  it('não deve permitir que Fornecedor A leia o portfólio de Fornecedor B', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_portfolio_items')
      .select('id')
      .eq('id', portfolioItemBId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que Fornecedor A leia a assinatura de Fornecedor B', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_subscriptions')
      .select('id')
      .eq('vendor_id', vendorBId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que Fornecedor A leia os checkouts de pagamento de Fornecedor B', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_payment_checkouts')
      .select('id')
      .eq('vendor_id', vendorBId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('deve permitir que Fornecedor B leia a própria assinatura e checkouts', async () => {
    const { data: subs, error: subsError } = await vendorB.client
      .from('vendor_subscriptions')
      .select('id')
      .eq('vendor_id', vendorBId)
    expect(subsError).toBeNull()
    expect(subs).toHaveLength(1)

    const { data: checkouts, error: checkoutsError } = await vendorB.client
      .from('vendor_payment_checkouts')
      .select('id')
      .eq('vendor_id', vendorBId)
    expect(checkoutsError).toBeNull()
    expect(checkouts).toHaveLength(1)
  })

  // Mesma lição já aprendida uma vez do lado do casal (SEC-01,
  // 20260727000003_security-audit-fixes.sql: subscriptions permitia
  // auto-concessão de plano pago) — vendor_subscriptions não tem NENHUMA policy de
  // INSERT/UPDATE pra `authenticated`, nem pro próprio dono. Toda escrita é
  // service role (webhook) ou fn_redeem_vendor_coupon (SECURITY DEFINER).
  it('não deve permitir que o próprio fornecedor grave uma assinatura ativa via INSERT direto', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_subscriptions')
      .insert({ vendor_id: vendorAId, plan_id: 'vendor_lifetime', status: 'active' })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('não deve permitir que o próprio fornecedor atualize a própria assinatura via UPDATE direto', async () => {
    await service.from('vendor_subscriptions').insert({ vendor_id: vendorAId, plan_id: 'vendor_monthly', status: 'pending' })

    const { data, error } = await vendorA.client
      .from('vendor_subscriptions')
      .update({ status: 'active' })
      .eq('vendor_id', vendorAId)
      .select('id')
    expect(error).toBeNull() // USING nunca bate (sem policy de UPDATE) -> 0 linhas, sem erro
    expect(data).toEqual([])

    const { data: check } = await service.from('vendor_subscriptions').select('status').eq('vendor_id', vendorAId).single()
    expect((check as { status: string } | null)?.status).toBe('pending')
  })

  it('deve permitir que o próprio fornecedor crie e atualize seu próprio checkout de pagamento', async () => {
    const mpReference = `test-own-ref-${crypto.randomUUID()}`
    const { data: inserted, error: insertError } = await vendorA.client
      .from('vendor_payment_checkouts')
      .insert({ vendor_id: vendorAId, vendor_plan_id: 'vendor_monthly', mp_reference: mpReference, amount_cents: 2000 })
      .select('id')
      .single()
    expect(insertError).toBeNull()
    expect(inserted).not.toBeNull()

    const { data: updated, error: updateError } = await vendorA.client
      .from('vendor_payment_checkouts')
      .update({ mp_preapproval_id: 'preapproval-123' })
      .eq('id', (inserted as { id: string }).id)
      .select('mp_preapproval_id')
    expect(updateError).toBeNull()
    expect(updated).toEqual([{ mp_preapproval_id: 'preapproval-123' }])
  })

  // IDOR: a policy nova (20260831000003) é escopada por fn_owns_vendor(vendor_id,
  // auth.uid()) — um fornecedor não pode criar (nem atualizar) um checkout em NOME
  // de outro fornecedor, mesmo agora que INSERT/UPDATE de authenticated existe.
  it('não deve permitir que Fornecedor A crie um checkout de pagamento em nome de Fornecedor B', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_payment_checkouts')
      .insert({ vendor_id: vendorBId, vendor_plan_id: 'vendor_monthly', mp_reference: `test-idor-${crypto.randomUUID()}`, amount_cents: 2000 })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('não deve permitir que Fornecedor A atualize o checkout de pagamento de Fornecedor B', async () => {
    const { data: bCheckout } = await service
      .from('vendor_payment_checkouts')
      .select('id')
      .eq('vendor_id', vendorBId)
      .limit(1)
      .single()

    const { data, error } = await vendorA.client
      .from('vendor_payment_checkouts')
      .update({ status: 'approved' })
      .eq('id', (bCheckout as { id: string }).id)
      .select('id')
    expect(error).toBeNull() // USING não bate -> 0 linhas, sem erro
    expect(data).toEqual([])
  })
})
