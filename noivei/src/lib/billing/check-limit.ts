import type { SupabaseClient } from '@supabase/supabase-js'

import { PLAN_IDS, type PlanId } from '@/constants/plans'

export interface LimitCheck {
  allowed: boolean
  current: number
  limit:   number
  planId:  PlanId
}

/**
 * Resolve o plano ativo de um casamento a partir da assinatura do DONO
 * (weddings.user_id) — nunca do usuário logado no momento da chamada. Isso
 * importa desde que "juntar contas" existe: um membro convidado tem a própria
 * conta (e a própria assinatura Gratuita padrão), mas o plano que vale pra
 * gating de features é sempre o do dono que paga a assinatura do casamento.
 * Sem casamento ou sem assinatura ativa, assume o plano Gratuito.
 *
 * Chama a function `fn_resolve_wedding_plan` (1 round-trip no banco) em vez de
 * fazer 2 queries sequenciais aqui — essa resolução roda em praticamente toda
 * página autenticada (layout, dashboard, paywall-gate...), então cada round-trip
 * a menos é sentido em toda navegação do app.
 */
export async function resolveWeddingPlanId(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<PlanId> {
  const { data } = await supabase.rpc('fn_resolve_wedding_plan', { p_wedding_id: weddingId })
  return (data as PlanId | null) ?? PLAN_IDS.FREE
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
  const planId = await resolveWeddingPlanId(supabase, weddingId)

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
 * Verifica o limite de armazenamento do plano ativo do dono do casamento.
 * `current` e `limit` são retornados em bytes — `plan_limits.max_storage_mb` guarda o valor em MB.
 * `additionalBytes` é o tamanho do arquivo que se pretende adicionar; `allowed` considera o uso
 * já existente somado a ele, já que aqui (diferente de convidados) cada upload tem um peso diferente.
 * A cota é única para a conta: soma a Central de arquivos (wedding_files), as fotos da
 * Galeria do site (wedding_gallery_photos) e as fotos enviadas na Lista de presentes
 * (gift_registry_items.image_size_bytes) — não são pools separados.
 */
export async function checkStorageLimit(
  supabase:        SupabaseClient,
  weddingId:       string,
  additionalBytes: number,
): Promise<LimitCheck> {
  const planId = await resolveWeddingPlanId(supabase, weddingId)

  const [{ data: files }, { data: galleryPhotos }, { data: giftPhotos }, { data: limitRow }] = await Promise.all([
    supabase
      .from('wedding_files')
      .select('size_bytes')
      .eq('wedding_id', weddingId),
    supabase
      .from('wedding_gallery_photos')
      .select('size_bytes')
      .eq('wedding_id', weddingId),
    supabase
      .from('gift_registry_items')
      .select('image_size_bytes')
      .eq('wedding_id', weddingId)
      .not('image_size_bytes', 'is', null),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_storage_mb')
      .maybeSingle(),
  ])

  const sumSizeBytes = (rows: { size_bytes: number }[] | null) =>
    (rows ?? []).reduce((sum, row) => sum + row.size_bytes, 0)

  const current = sumSizeBytes(files as { size_bytes: number }[] | null)
    + sumSizeBytes(galleryPhotos as { size_bytes: number }[] | null)
    + sumSizeBytes(
        ((giftPhotos ?? []) as { image_size_bytes: number | null }[])
          .map((row) => ({ size_bytes: row.image_size_bytes ?? 0 })),
      )
  const limitMb = (limitRow?.value as number | undefined) ?? DEFAULT_STORAGE_LIMIT_MB
  const limit   = limitMb * BYTES_PER_MB
  const allowed = current + additionalBytes <= limit

  return { allowed, current, limit, planId }
}

// Fallback conservador (= plano Gratuito) caso o seed de plan_limits esteja ausente
const DEFAULT_USER_LIMIT = 1

/**
 * Verifica o limite de usuários ("juntar contas") do plano ativo do dono do
 * casamento. `current` conta as linhas em wedding_members (dono incluso).
 */
export async function checkMemberLimit(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<LimitCheck> {
  const planId = await resolveWeddingPlanId(supabase, weddingId)

  const [{ count: current }, { data: limitRow }] = await Promise.all([
    supabase
      .from('wedding_members')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_users')
      .maybeSingle(),
  ])

  const limit   = (limitRow?.value as number | undefined) ?? DEFAULT_USER_LIMIT
  const allowed = (current ?? 0) < limit

  return { allowed, current: current ?? 0, limit, planId }
}

// Fallback conservador (= plano Gratuito) caso o seed de plan_limits esteja ausente
const DEFAULT_FINANCIAL_ENTRY_LIMIT = 15

/**
 * Verifica o limite de lançamentos financeiros do plano ativo do dono do
 * casamento. `current` conta as linhas em financial_entries pelo wedding_id.
 */
export async function checkFinancialEntryLimit(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<LimitCheck> {
  const planId = await resolveWeddingPlanId(supabase, weddingId)

  const [{ count: current }, { data: limitRow }] = await Promise.all([
    supabase
      .from('financial_entries')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_financial_entries')
      .maybeSingle(),
  ])

  const limit   = (limitRow?.value as number | undefined) ?? DEFAULT_FINANCIAL_ENTRY_LIMIT
  const allowed = (current ?? 0) < limit

  return { allowed, current: current ?? 0, limit, planId }
}

// Fallback conservador (= plano Gratuito) caso o seed de plan_limits esteja ausente
const DEFAULT_WEDDING_PARTY_LIMIT = 2

/**
 * Verifica o limite de entradas do cortejo (Padrinhos & Entradas) do plano ativo
 * do dono do casamento. A entrada dos noivos é sempre implícita na UI (não é uma
 * linha em wedding_party_entries), então o limite do Gratuito conta só as
 * entradas ADICIONAIS.
 */
export async function checkWeddingPartyLimit(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<LimitCheck> {
  const planId = await resolveWeddingPlanId(supabase, weddingId)

  const [{ count: current }, { data: limitRow }] = await Promise.all([
    supabase
      .from('wedding_party_entries')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId),
    supabase
      .from('plan_limits')
      .select('value')
      .eq('plan_id', planId)
      .eq('feature', 'max_wedding_party_entries')
      .maybeSingle(),
  ])

  const limit   = (limitRow?.value as number | undefined) ?? DEFAULT_WEDDING_PARTY_LIMIT
  const allowed = (current ?? 0) < limit

  return { allowed, current: current ?? 0, limit, planId }
}
