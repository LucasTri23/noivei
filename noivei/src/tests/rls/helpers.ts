// Harness compartilhado dos testes de RLS (src/tests/rls/) — a convenção em
// CLAUDE.md já pedia "Testes de RLS em src/tests/rls/", mas nenhum teste de RLS
// existia neste projeto até agora (não havia harness prévio pra seguir). Este
// arquivo é a base: cria/derruba usuários reais via Auth admin API e devolve
// clientes supabase-js autenticados de verdade (JWT de sessão), pra exercitar as
// policies de RLS tal como o Postgres as avalia — não é possível testar RLS de
// verdade com um client mockado, precisa de um Postgres real por trás.
//
// Requer um projeto Supabase local/de teste rodando (ex.: `supabase start`) e as
// variáveis de ambiente padrão do projeto (NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) apontando pra ele —
// NUNCA rodar isto contra produção (o setup cria/apaga usuários de verdade).
// hasLiveSupabase() é a guarda: todo describe deste diretório usa
// `describe.skipIf(!hasLiveSupabase())`, então os testes pulam (não falham) num
// ambiente sem Postgres disponível, em vez de fingir sucesso ou quebrar o `npm test`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function hasLiveSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export interface TestUser {
  userId: string
  email:  string
  client: SupabaseClient<Database> // sessão autenticada de verdade (JWT), sujeita a RLS
}

// Cria um usuário real via Auth admin API (dispara trg_users_on_insert -> profiles +
// subscriptions gratuita, igual a um signup de verdade) e devolve um client já
// autenticado com a sessão dele. `service` é reaproveitado entre vários usuários no
// mesmo teste — evita recriar o client admin repetidas vezes.
export async function createTestUser(service: SupabaseClient<Database>, label: string): Promise<TestUser> {
  const email    = `rls-${label}-${crypto.randomUUID()}@example.test`
  const password = crypto.randomUUID()

  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Falha ao criar usuário de teste: ${error?.message}`)

  const client = createAnonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`Falha ao autenticar usuário de teste: ${signInError.message}`)

  return { userId: data.user.id, email, client }
}

// auth.users -> weddings/vendor_profiles/... tudo em ON DELETE CASCADE (ver
// CLAUDE.md: "Foreign keys sempre com ON DELETE CASCADE para dados filhos") —
// apagar o usuário já limpa tudo que o teste criou a partir dele.
export async function deleteTestUser(service: SupabaseClient<Database>, userId: string): Promise<void> {
  await service.auth.admin.deleteUser(userId)
}

export async function createTestWedding(
  service: SupabaseClient<Database>, userId: string, coupleNames = 'Casal de Teste',
): Promise<string> {
  const { data, error } = await service
    .from('weddings')
    .insert({ user_id: userId, couple_names: coupleNames })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Falha ao criar casamento de teste: ${error?.message}`)
  return (data as { id: string }).id
}

interface TestVendorOverrides {
  status?:   string
  featured?: boolean
  slug?:     string
}

export async function createTestVendor(
  service: SupabaseClient<Database>, userId: string, overrides: TestVendorOverrides = {},
): Promise<string> {
  const { data, error } = await service
    .from('vendor_profiles')
    .insert({
      user_id:       userId,
      business_name: 'Fornecedor de Teste',
      slug:          overrides.slug ?? `fornecedor-teste-${crypto.randomUUID()}`,
      status:        overrides.status ?? 'draft',
      featured:      overrides.featured ?? false,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Falha ao criar fornecedor de teste: ${error?.message}`)
  return (data as { id: string }).id
}

// Assinatura ativa sem expiração — necessária junto de status='active' pra o
// fornecedor passar em fn_vendor_is_publicly_visible().
export async function createActiveVendorSubscription(
  service: SupabaseClient<Database>, vendorId: string, planId = 'vendor_monthly',
): Promise<void> {
  const { error } = await service
    .from('vendor_subscriptions')
    .insert({ vendor_id: vendorId, plan_id: planId, status: 'active' })
  if (error) throw new Error(`Falha ao criar assinatura de teste: ${error?.message}`)
}
