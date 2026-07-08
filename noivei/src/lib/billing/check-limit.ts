import type { SupabaseClient } from '@supabase/supabase-js'

import { PLAN_IDS, type PlanId } from '@/constants/plans'

export interface LimitCheck {
  allowed: boolean
  current: number
  limit:   number
  planId:  PlanId
}

// Fallback conservador (= plano Gratuito) caso o seed de plan_limits esteja ausente
const DEFAULT_GUEST_LIMIT = 50

/**
 * Verifica o limite de convidados do plano ativo do dono do casamento.
 * Sem assinatura ativa, assume o plano Gratuito.
 */
export async function checkGuestLimit(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<LimitCheck> {
  const { data: wedding } = await supabase
    .from('weddings')
    .select('user_id')
    .eq('id', weddingId)
    .is('deleted_at', null)
    .maybeSingle()

  let planId: PlanId = PLAN_IDS.FREE

  if (wedding?.user_id) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', wedding.user_id as string)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscription?.plan_id) planId = subscription.plan_id as PlanId
  }

  const [{ count: current }, { data: limitRow }] = await Promise.all([
    supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_guests')
      .maybeSingle(),
  ])

  const limit   = (limitRow?.value as number | undefined) ?? DEFAULT_GUEST_LIMIT
  const allowed = (current ?? 0) < limit

  return { allowed, current: current ?? 0, limit, planId }
}
