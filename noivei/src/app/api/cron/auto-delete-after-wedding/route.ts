// Marca pra exclusão (soft delete) automaticamente qualquer casamento cuja data
// já passou há mais tempo do que o prazo de retenção do plano ativo do dono
// (plan_limits.retention_days_after_wedding — migration
// 20260805000011_add-retention-days-after-wedding-limit.sql): 30 dias no
// Gratuito, 365 dias nos planos pagos, contados a partir de weddings.wedding_date.
//
// Só MARCA (weddings.deleted_at = agora) — não apaga nada aqui. A partir daí, o
// fluxo de sempre assume: /api/cron/purge-accounts limpa Storage e banco depois
// do prazo configurado em app_settings.account_purge_days, do jeito que já
// acontece pra qualquer exclusão de conta pedida manualmente pelo casal.
//
// Protegida por CRON_SECRET — mesmo padrão de notify-overdue/purge-accounts.

import { err, handleApiError, ok } from '@/lib/api/response'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { constantTimeEqual } from '@/lib/security/constant-time-compare'
import { createSupabaseService } from '@/lib/supabase/service'

const DEFAULT_RETENTION_DAYS = 30 // conservador (= Gratuito) se o plan_limits estiver ausente

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!secret || !authHeader || !constantTimeEqual(authHeader, `Bearer ${secret}`)) {
      return err(401, 'UNAUTHORIZED', 'Não autorizado.')
    }

    const supabase = createSupabaseService()

    // "Hoje" em America/Sao_Paulo — mesmo padrão de notify-wedding-milestones,
    // pra bater com o fuso do casal, não o fuso UTC do servidor.
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // Só candidatos: casamento com data preenchida e ainda não marcado pra
    // exclusão. Sem limite de "há quanto tempo" na query — o prazo de retenção
    // varia por plano, então o filtro real acontece depois, por casamento.
    const { data: weddings, error: weddingsError } = await supabase
      .from('weddings')
      .select('id, wedding_date')
      .is('deleted_at', null)
      .not('wedding_date', 'is', null)
      .lt('wedding_date', today)

    if (weddingsError) return err(500, 'DB_ERROR', 'Erro ao buscar casamentos.')

    let markedForDeletion = 0

    for (const wedding of (weddings ?? []) as { id: string; wedding_date: string }[]) {
      try {
        const planId = await resolveWeddingPlanId(supabase, wedding.id)

        const { data: limitRow } = await supabase
          .from('plan_limits')
          .select('value')
          .eq('plan_id', planId)
          .eq('feature', 'retention_days_after_wedding')
          .maybeSingle()

        const retentionDays = (limitRow?.value as number | undefined) ?? DEFAULT_RETENTION_DAYS

        const [wy = 0, wm = 1, wd = 1] = wedding.wedding_date.split('-').map(Number)
        const [ty = 0, tm = 1, td = 1] = today.split('-').map(Number)
        const daysSinceWedding = Math.round(
          (Date.UTC(ty, tm - 1, td) - Date.UTC(wy, wm - 1, wd)) / 86_400_000,
        )

        if (daysSinceWedding < retentionDays) continue

        const { error: updateError } = await supabase
          .from('weddings')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', wedding.id)
          .is('deleted_at', null) // defesa contra corrida: não sobrescreve se já foi marcado nesse meio-tempo

        if (updateError) {
          console.error(`[cron/auto-delete-after-wedding] falha ao marcar casamento ${wedding.id}:`, updateError)
          continue
        }

        markedForDeletion += 1
      } catch (error) {
        console.error(`[cron/auto-delete-after-wedding] falha ao processar casamento ${wedding.id}:`, error)
      }
    }

    return ok({ evaluated: weddings?.length ?? 0, markedForDeletion })
  } catch (error) {
    return handleApiError(error)
  }
}
