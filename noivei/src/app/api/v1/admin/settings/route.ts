import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateAppSettingsSchema } from '@/lib/api/validation/admin-settings.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const { data, error } = await supabase
      .from('app_settings')
      .select('platform_fee_percent, account_purge_days')
      .eq('id', true)
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao buscar configurações.')

    // Number(...) por segurança: NUMERIC/INTEGER do Postgres pode vir como string via PostgREST.
    return ok({
      platform_fee_percent: Number(data?.platform_fee_percent ?? 5),
      account_purge_days:   Number(data?.account_purge_days ?? 30),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-settings-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = UpdateAppSettingsSchema.safeParse(body)
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const { data, error } = await supabase
      .from('app_settings')
      .update({
        platform_fee_percent: parsed.data.platform_fee_percent,
        account_purge_days:   parsed.data.account_purge_days,
      })
      .eq('id', true)
      .select('platform_fee_percent, account_purge_days')
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao salvar configurações.')

    return ok({
      platform_fee_percent: Number(data.platform_fee_percent),
      account_purge_days:   Number(data.account_purge_days),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
