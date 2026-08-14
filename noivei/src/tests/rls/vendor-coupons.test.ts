// RLS: vendor_coupons / vendor_coupon_redemptions — admin-only na tabela, resgate
// só via fn_redeem_vendor_coupon() (RPC, SECURITY DEFINER). Ver
// supabase/migrations/20260806000003_create-vendor-marketplace-billing.sql.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createServiceClient, createTestUser, createTestVendor,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// createServiceClient() só roda dentro de beforeAll — ver comentário em
// vendor-profiles.test.ts (corpo do describe executa mesmo em suítes puladas).
describe.skipIf(!hasLiveSupabase())('RLS vendor_coupons / fn_redeem_vendor_coupon', () => {
  let service: SupabaseClient<Database>
  let vendorA: TestUser
  let vendorAId: string
  let couponCode: string
  let couponId: string

  beforeAll(async () => {
    service = createServiceClient()
    vendorA = await createTestUser(service, 'vendor-a')
    vendorAId = await createTestVendor(service, vendorA.userId)

    couponCode = `TESTE${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const { data: coupon, error } = await service
      .from('vendor_coupons')
      .insert({ code: couponCode, discount_type: 'percent', discount_value: 10 })
      .select('id')
      .single()
    if (error || !coupon) throw new Error(`Falha ao criar cupom de teste: ${error?.message}`)
    couponId = (coupon as { id: string }).id
  })

  afterAll(async () => {
    await deleteTestUser(service, vendorA.userId)
  })

  it('não deve permitir que um fornecedor não-admin leia vendor_coupons diretamente', async () => {
    const { data, error } = await vendorA.client.from('vendor_coupons').select('id').eq('id', couponId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('não deve permitir que um fornecedor não-admin crie um vendor_coupons diretamente', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_coupons')
      .insert({ code: 'HACK10', discount_type: 'percent', discount_value: 50 })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('deve permitir que o fornecedor resgate um cupom válido via RPC fn_redeem_vendor_coupon', async () => {
    const { data, error } = await vendorA.client.rpc('fn_redeem_vendor_coupon', {
      p_code: couponCode, p_vendor_id: vendorAId,
    })
    expect(error).toBeNull()
    expect(data).toEqual([{ discount_type: 'percent', discount_value: 10, applies_to_plan_id: null, benefit_days: null }])
  })

  it('não deve permitir resgatar o mesmo cupom duas vezes pelo mesmo fornecedor', async () => {
    const { error } = await vendorA.client.rpc('fn_redeem_vendor_coupon', {
      p_code: couponCode, p_vendor_id: vendorAId,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('already_redeemed')
  })

  it('não deve permitir resgatar um código de cupom inexistente', async () => {
    const { error } = await vendorA.client.rpc('fn_redeem_vendor_coupon', {
      p_code: 'NAO-EXISTE', p_vendor_id: vendorAId,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('coupon_not_found')
  })
})
