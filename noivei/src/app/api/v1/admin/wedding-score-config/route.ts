import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateWeddingScoreConfigSchema } from '@/lib/api/validation/admin-wedding-score.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'

const CONFIG_COLUMNS =
  'enabled, title, description, label_low, description_low, label_mid, description_mid, label_high, description_high'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const [{ data: config, error: configError }, { data: weights, error: weightsError }] = await Promise.all([
      supabase.from('wedding_score_config').select(CONFIG_COLUMNS).eq('id', true).maybeSingle(),
      supabase.from('wedding_score_module_weights').select('module_key, label, weight, sort_order').order('sort_order'),
    ])

    if (configError || weightsError) return err(500, 'DB_ERROR', 'Erro ao buscar configuração do Wedding Score.')

    return ok({ config, weights: weights ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-wedding-score-write:${user.id}`, 50, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = UpdateWeddingScoreConfigSchema.safeParse(body)
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const { weights, ...configFields } = parsed.data

    const [{ data: config, error: configError }, weightResults] = await Promise.all([
      supabase
        .from('wedding_score_config')
        .update(configFields)
        .eq('id', true)
        .select(CONFIG_COLUMNS)
        .single(),
      // Os 7 módulos já existem sempre (seedados na migration 20260805000008) —
      // UPDATE por module_key em vez de upsert, pra nunca depender de reconstruir
      // as demais colunas NOT NULL (label, sort_order) que este formulário não edita.
      Promise.all(
        weights.map((w) =>
          supabase
            .from('wedding_score_module_weights')
            .update({ weight: w.weight })
            .eq('module_key', w.module_key)
            .select('module_key, label, weight, sort_order')
            .single(),
        ),
      ),
    ])

    if (configError) return err(500, 'DB_ERROR', 'Erro ao salvar configuração do Wedding Score.')

    const weightsError = weightResults.find((result) => result.error)
    if (weightsError) return err(500, 'DB_ERROR', 'Erro ao salvar os pesos dos módulos.')

    const updatedWeights = weightResults
      .map((result) => result.data)
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))

    return ok({ config, weights: updatedWeights })
  } catch (error) {
    return handleApiError(error)
  }
}
