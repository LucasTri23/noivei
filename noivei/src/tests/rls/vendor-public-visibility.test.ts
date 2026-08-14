// RLS: visibilidade pública centralizada em fn_vendor_is_publicly_visible() — só
// fornecedor com status='active' E assinatura vendor_subscriptions ativa (não
// expirada) aparece pra SELECT anônimo/de terceiros. Ver
// supabase/migrations/20260806000003_create-vendor-marketplace-billing.sql.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createActiveVendorSubscription, createServiceClient, createTestUser, createTestVendor,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// createServiceClient() só roda dentro de beforeAll — ver comentário em
// vendor-profiles.test.ts (corpo do describe executa mesmo em suítes puladas).
describe.skipIf(!hasLiveSupabase())('RLS visibilidade pública de vendor_profiles', () => {
  let service: SupabaseClient<Database>

  // "Terceiro" aqui é qualquer usuário autenticado que não é dono nem admin — a
  // policy pública cobre tanto anon quanto authenticated-de-terceiros com a mesma
  // condição (fn_vendor_is_publicly_visible), então testar com um usuário
  // autenticado qualquer já cobre os dois casos.
  let outsider: TestUser
  let draftVendor: TestUser
  let pausedVendor: TestUser
  let activeVendorNoSub: TestUser
  let activeVendorWithSub: TestUser

  let draftVendorId: string
  let pausedVendorId: string
  let activeNoSubId: string
  let activeWithSubId: string

  beforeAll(async () => {
    service = createServiceClient()
    outsider             = await createTestUser(service, 'outsider')
    draftVendor           = await createTestUser(service, 'draft')
    pausedVendor          = await createTestUser(service, 'paused')
    activeVendorNoSub     = await createTestUser(service, 'active-no-sub')
    activeVendorWithSub   = await createTestUser(service, 'active-with-sub')

    draftVendorId   = await createTestVendor(service, draftVendor.userId,   { status: 'draft' })
    pausedVendorId  = await createTestVendor(service, pausedVendor.userId,  { status: 'paused' })
    activeNoSubId   = await createTestVendor(service, activeVendorNoSub.userId,   { status: 'active' })
    activeWithSubId = await createTestVendor(service, activeVendorWithSub.userId, { status: 'active' })

    await createActiveVendorSubscription(service, activeWithSubId)
    // activeNoSubId e pausedVendorId de propósito SEM assinatura ativa —
    // pausedVendorId testa "status errado", activeNoSubId testa "sem assinatura
    // mesmo com status certo" (as duas metades do AND em fn_vendor_is_publicly_visible).
    await createActiveVendorSubscription(service, pausedVendorId)
  })

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(service, outsider.userId),
      deleteTestUser(service, draftVendor.userId),
      deleteTestUser(service, pausedVendor.userId),
      deleteTestUser(service, activeVendorNoSub.userId),
      deleteTestUser(service, activeVendorWithSub.userId),
    ])
  })

  it('não deve listar publicamente um fornecedor em draft', async () => {
    const { data } = await outsider.client.from('vendor_profiles').select('id').eq('id', draftVendorId)
    expect(data).toEqual([])
  })

  it('não deve listar publicamente um fornecedor pausado, mesmo com assinatura ativa', async () => {
    const { data } = await outsider.client.from('vendor_profiles').select('id').eq('id', pausedVendorId)
    expect(data).toEqual([])
  })

  it('não deve listar publicamente um fornecedor ativo sem assinatura ativa', async () => {
    const { data } = await outsider.client.from('vendor_profiles').select('id').eq('id', activeNoSubId)
    expect(data).toEqual([])
  })

  it('deve listar publicamente um fornecedor ativo com assinatura ativa', async () => {
    const { data, error } = await outsider.client.from('vendor_profiles').select('id').eq('id', activeWithSubId)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: activeWithSubId }])
  })

  it('deve aplicar a mesma regra de visibilidade em vendor_category_links e vendor_portfolio_items', async () => {
    const { data: categories } = await service.from('vendor_categories').select('id').eq('slug', 'buffet').limit(1)
    const categoryId = (categories as { id: string }[] | null)?.[0]?.id
    expect(categoryId).toBeTruthy()

    await service.from('vendor_category_links').insert([
      { vendor_id: draftVendorId, category_id: categoryId },
      { vendor_id: activeWithSubId, category_id: categoryId },
    ])
    await service.from('vendor_portfolio_items').insert([
      { vendor_id: draftVendorId, storage_path: `${draftVendorId}/foto.jpg` },
      { vendor_id: activeWithSubId, storage_path: `${activeWithSubId}/foto.jpg` },
    ])

    const { data: linksDraft }   = await outsider.client.from('vendor_category_links').select('vendor_id').eq('vendor_id', draftVendorId)
    const { data: linksActive }  = await outsider.client.from('vendor_category_links').select('vendor_id').eq('vendor_id', activeWithSubId)
    const { data: itemsDraft }   = await outsider.client.from('vendor_portfolio_items').select('vendor_id').eq('vendor_id', draftVendorId)
    const { data: itemsActive }  = await outsider.client.from('vendor_portfolio_items').select('vendor_id').eq('vendor_id', activeWithSubId)

    expect(linksDraft).toEqual([])
    expect(linksActive).toEqual([{ vendor_id: activeWithSubId }])
    expect(itemsDraft).toEqual([])
    expect(itemsActive).toEqual([{ vendor_id: activeWithSubId }])
  })
})
