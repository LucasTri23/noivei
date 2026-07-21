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

const BYTES_PER_MB = 1024 * 1024

// Fallback conservador (= plano Gratuito) caso o seed de plan_limits esteja ausente
const DEFAULT_STORAGE_LIMIT_MB = 100

/**
 * Verifica o limite de armazenamento (Central de arquivos) do plano ativo do dono do casamento.
 * `current` e `limit` são retornados em bytes — `plan_limits.max_storage_mb` guarda o valor em MB.
 * `additionalBytes` é o tamanho do arquivo que se pretende adicionar; `allowed` considera o uso
 * já existente somado a ele, já que aqui (diferente de convidados) cada upload tem um peso diferente.
 */
export async function checkStorageLimit(
  supabase:        SupabaseClient,
  weddingId:       string,
  additionalBytes: number,
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

  const [{ data: files }, { data: limitRow }] = await Promise.all([
    supabase
      .from('wedding_files')
      .select('size_bytes')
      .eq('wedding_id', weddingId),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_storage_mb')
      .maybeSingle(),
  ])

  const current = ((files ?? []) as { size_bytes: number }[]).reduce(
    (sum, file) => sum + file.size_bytes,
    0,
  )
  const limitMb = (limitRow?.value as number | undefined) ?? DEFAULT_STORAGE_LIMIT_MB
  const limit   = limitMb * BYTES_PER_MB
  const allowed = current + additionalBytes <= limit

  return { allowed, current, limit, planId }
}
