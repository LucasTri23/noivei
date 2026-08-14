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

  // RISCO DOCUMENTADO DE PROPÓSITO — NÃO é um bug desta migration: RLS é só de
  // LINHA, não de coluna (ver comentário na policy "vendor can update own profile").
  // A policy de UPDATE libera o fornecedor a atualizar A PRÓPRIA linha inteira, sem
  // nenhuma restrição de coluna — não existe forma de RLS negar update de
  // status/featured mas permitir o resto na MESMA linha. Este teste PASSA
  // demonstrando que a atualização TEM SUCESSO, exatamente para deixar registrado
  // que a única defesa real contra auto-aprovação/auto-destaque é o endpoint de
  // autoedição do fornecedor (fase futura) nunca incluir esses campos no schema Zod
  // de update — a RLS sozinha NÃO é suficiente aqui.
  it('RLS permite tecnicamente que o fornecedor grave featured=true e status=active em si mesmo via UPDATE direto — a API é quem PRECISA bloquear esses campos', async () => {
    const { data, error } = await vendorA.client
      .from('vendor_profiles')
      .update({ featured: true, status: 'active' })
      .eq('id', vendorAId)
      .select('featured, status')

    expect(error).toBeNull()
    expect(data).toEqual([{ featured: true, status: 'active' }])
    // Sem assinatura ativa, mesmo com status='active' o fornecedor continua fora do
    // marketplace público (fn_vendor_is_publicly_visible exige as duas coisas) —
    // mas a LINHA em si foi alterada com sucesso, e é isso que este teste documenta.
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
