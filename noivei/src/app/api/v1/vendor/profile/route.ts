import { requireAccountType } from '@/lib/auth/account-type'
import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateVendorProfileSchema, UpdateVendorProfileSchema } from '@/lib/api/validation/vendor.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { generateUniqueVendorSlug, nextSlugCandidate } from '@/lib/vendor/slug'
import type { VendorProfile } from '@/types/database'

const SLUG_INSERT_ATTEMPTS = 5

// Cria o próprio perfil de fornecedor ("virar fornecedor") — nasce sempre status
// 'draft'/featured=false (nunca aceito do client, ver vendor.schema.ts), um por
// conta (409 se já existir linha pra este user_id). O passo 1 do wizard de cadastro
// (src/components/vendors/onboarding/vendor-onboarding-wizard.tsx) chama esta rota
// pra ganhar um vendor_profiles.id antes de anexar categoria/portfólio nos passos
// seguintes.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAccountType(supabase, 'vendor')

    // Isso só deveria acontecer uma vez de verdade por fornecedor — teto baixo,
    // mesmo espírito do rate limit de export-data (ação pesada e não repetível em
    // uso normal).
    const limitCheck = await checkRateLimit(supabase, `vendor-create-profile:${user.id}`, 5, 3600)
    if (!limitCheck.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const body = await parseJsonBody(req)
    const parsed = CreateVendorProfileSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: existing, error: existingError } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) return err(500, 'DB_ERROR', 'Erro ao verificar perfil de fornecedor.')
    if (existing) return err(409, 'VENDOR_ALREADY_EXISTS', 'Você já tem um cadastro de fornecedor.')

    const baseSlug = await generateUniqueVendorSlug(supabase, parsed.data.business_name)
    let slug = baseSlug

    for (let attempt = 0; attempt < SLUG_INSERT_ATTEMPTS; attempt++) {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .insert({ ...parsed.data, user_id: user.id, slug })
        .select()
        .single()

      if (!error) return ok(data as VendorProfile, undefined, 201)

      if (error.code === '23505') {
        // Duas UNIQUE nesta tabela: user_id (conta já tem perfil — corrida contra o
        // próprio duplo-clique, já que checamos acima) e slug (corrida contra outro
        // fornecedor que a RLS não deixou a pré-checagem de generateUniqueVendorSlug
        // enxergar). Distingue pela constraint no texto do erro do Postgres.
        if (error.message.includes('vendor_profiles_user_id_key')) {
          return err(409, 'VENDOR_ALREADY_EXISTS', 'Você já tem um cadastro de fornecedor.')
        }
        slug = nextSlugCandidate(baseSlug)
        continue
      }

      return err(500, 'DB_ERROR', 'Erro ao criar perfil de fornecedor.')
    }

    return err(500, 'SLUG_GENERATION_FAILED', 'Não foi possível gerar um endereço único para o seu perfil. Tente novamente.')
  } catch (error) {
    return handleApiError(error)
  }
}

// Autoedição do próprio perfil — mesma disciplina de whitelist do POST acima
// (UpdateVendorProfileSchema nunca aceita status/featured/rejection_reason/
// deleted_at), então `parsed.data` é sempre seguro pra ir direto num .update().
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = UpdateVendorProfileSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_profiles')
      .update(parsed.data)
      .eq('id', vendor.id)
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar perfil de fornecedor.')

    return ok(data as VendorProfile)
  } catch (error) {
    return handleApiError(error)
  }
}
