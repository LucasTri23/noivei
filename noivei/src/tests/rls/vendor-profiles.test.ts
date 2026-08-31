// RLS: vendor_profiles — isolamento entre fornecedores e o risco documentado da
// policy de UPDATE (ver comentário em
// supabase/migrations/20260806000002_create-vendor-marketplace-identity.sql).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createServiceClient, createTestUser, createTestVendor,
  deleteTestUser, hasLiveSupabase, type TestUser,
} from './helpers'

// createServiceClient() só roda dentro de beforeAll (nunca no corpo do describe):
// o corpo do describe executa na COLETA de testes, mesmo pra suítes puladas por
// skipIf — instanciar o client ali quebraria o `npm test` num ambiente sem
// Supabase (as env vars nem existem). beforeAll já é pulado de verdade pelo skipIf.
describe.skipIf(!hasLiveSupabase())('RLS vendor_profiles', () => {
  let service: SupabaseClient<Database>
  let vendorA: TestUser
  let vendorB: TestUser
  let vendorAId: string
  let vendorBId: string

  beforeAll(async () => {
    service = createServiceClient()
    vendorA = await createTestUser(service, 'vendor-a')
    vendorB = await createTestUser(service, 'vendor-b')
    vendorAId = await createTestVendor(service, vendorA.userId)
    vendorBId = await createTestVendor(service, vendorB.userId)
  })

  afterAll(async () => {
    await deleteTestUser(service, vendorA.userId)
    await deleteTestUser(service, vendorB.userId)
  })

  it('deve bloquear leitura do vendor_profiles de outro fornecedor via RLS', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_profiles')
      .select('id')
      .eq('id', vendorBId)

    // RLS filtra a linha silenciosamente (array vazio), não retorna erro — não
    // vaza a existência do recurso, mesmo padrão documentado em CLAUDE.md.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('deve bloquear atualização do vendor_profiles de outro fornecedor via RLS', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_profiles')
      .update({ business_name: 'Nome invadido' })
      .eq('id', vendorBId)
      .select('id')

    expect(error).toBeNull()
    expect(data).toEqual([]) // 0 linhas afetadas — USING não bateu, sem erro

    const { data: check } = await service.from('vendor_profiles').select('business_name').eq('id', vendorBId).single()
    expect((check as { business_name: string } | null)?.business_name).toBe('Fornecedor de Teste')
  })

  it('deve permitir que o próprio fornecedor leia e atualize seu vendor_profiles', async () => {
    const { data: readData, error: readError } = await vendorA.client
      .from('vendor_profiles')
      .select('id')
      .eq('id', vendorAId)
    expect(readError).toBeNull()
    expect(readData).toHaveLength(1)

    const { data: updateData, error: updateError } = await vendorA.client
      .from('vendor_profiles')
      .update({ business_name: 'Novo nome' })
      .eq('id', vendorAId)
      .select('id')
    expect(updateError).toBeNull()
    expect(updateData).toHaveLength(1)
  })

  // CORRIGIDO em 20260831000001 (defesa em profundidade, auditoria de comparação
  // Fase 1-9): RLS sozinha é só de LINHA (ver comentário histórico na policy "vendor
  // can update own profile") — mas agora um trigger BEFORE UPDATE
  // (fn_protect_vendor_profile_privileged_fields) reescreve status/featured/
  // rejection_reason/deleted_at/user_id de volta pro valor OLD sempre que quem
  // escreve não é service_role nem admin. O UPDATE ainda "funciona" (sem erro,
  // porque a RLS em si permite a linha), mas os campos privilegiados nunca mudam de
  // verdade — a API continua sendo a primeira linha de defesa (nunca aceita esses
  // campos no schema Zod), e agora o banco é a segunda, independente da API.
  it('não deve permitir que o fornecedor grave featured=true e status=active em si mesmo via UPDATE direto — trigger reverte pro valor anterior', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_profiles')
      .update({ featured: true, status: 'active' })
      .eq('id', vendorAId)
      .select('featured, status')

    expect(error).toBeNull()
    // O trigger reescreveu NEW.featured/NEW.status de volta pro valor anterior
    // (draft/false) antes do INSERT gravar — mesmo o UPDATE "tendo sucesso", nada mudou.
    expect(data).toEqual([{ featured: false, status: 'draft' }])

    const { data: check } = await service.from('vendor_profiles').select('featured, status').eq('id', vendorAId).single()
    expect(check).toEqual({ featured: false, status: 'draft' })
  })

  it('deve permitir que um ADMIN altere status/featured de qualquer fornecedor (trigger libera fn_is_admin)', async () => {
    const admin = await createTestUser(service, 'vendor-admin')
    await service.from('profiles').update({ role: 'admin' }).eq('id', admin.userId)

    const { data, error } = await admin.client
      .from('vendor_profiles')
      .update({ status: 'active', featured: true })
      .eq('id', vendorAId)
      .select('featured, status')

    expect(error).toBeNull()
    expect(data).toEqual([{ featured: true, status: 'active' }])

    // Devolve o fornecedor pro estado original pra não vazar estado entre os testes
    // deste describe (afterAll só apaga o usuário, não reseta vendor_profiles).
    await service.from('vendor_profiles').update({ status: 'draft', featured: false }).eq('id', vendorAId)
    await deleteTestUser(service, admin.userId)
  })

  // Diferente do UPDATE acima: CRIAR uma linha nova é diferente de editar uma
  // existente, então dá pra restringir isso na RLS sem custo nenhum — não existe
  // motivo legítimo pra um fornecedor nascer diferente de status='draft'/featured=false.
  it('não deve permitir que o fornecedor crie a própria linha já como active/featured via INSERT direto', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_profiles')
      .insert({ user_id: vendorA.userId, business_name: 'Furada', slug: `furada-${crypto.randomUUID()}`, status: 'active', featured: true })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})
