// RLS: portfólio e tabelas de cobrança do fornecedor (vendor_portfolio_items,
// vendor_subscriptions, vendor_payment_checkouts) — isolamento entre fornecedores
// e confirmação de que NENHUMA delas aceita INSERT/UPDATE de `authenticated`
// (toda escrita é service role / webhook / RPC, ver
// supabase/migrations/20260806000003_create-vendor-marketplace-billing.sql).
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
})
