import type { SupabaseClient } from '@supabase/supabase-js'

import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'

export interface AlbumInfo {
  weddingId:    string
  coupleNames:  string
  weddingColor: string
  // Personalização de cor é recurso pago — Gratuito nunca sobrescreve o
  // dourado padrão, mesmo critério já usado no RSVP público (ver
  // src/lib/rsvp/get-rsvp-by-token.ts).
  weddingColorSecondary: string | null
  // false tanto pra "módulo nunca contratado" quanto pra "admin desligou" —
  // as rotas de escrita (register/photos) tratam isso IDENTICAMENTE a token
  // inexistente (mesmo 404 genérico); só a página pública distingue pra
  // mostrar "recurso não disponível" em vez de "mural não encontrado".
  moduleEnabled: boolean
}

/**
 * Resolve o casamento a partir do album_token (weddings.album_token, UUID
 * único) — requer client service role, RLS não cobre acesso anônimo. Retorna
 * null só quando o token não existe/casamento foi soft-deletado; módulo
 * desabilitado é retornado como `moduleEnabled: false`, não como null (ver
 * comentário em AlbumInfo).
 */
export async function getAlbumByToken(
  supabase: SupabaseClient,
  token:    string,
): Promise<AlbumInfo | null> {
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('id, couple_names, wedding_color, wedding_color_secondary')
    .eq('album_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !wedding) return null

  const weddingId = wedding.id as string
  const planId = await resolveWeddingPlanId(supabase, weddingId)

  const { data: accessRow } = await supabase
    .from('plan_module_access')
    .select('enabled')
    .eq('plan_id', planId)
    .eq('module', 'album')
    .maybeSingle()

  // Mesmo critério fail-open do PaywallGate: linha ausente é tratada como
  // liberada. Na prática quase nunca acontece (fn_seed_plan_module_access já
  // grava 'album' pra todo plano, ver migration 20260803000001) — é só uma
  // defesa extra contra travar tudo por acidente se o seed faltar.
  const moduleEnabled = (accessRow?.enabled as boolean | undefined) ?? true

  return {
    weddingId,
    coupleNames:  wedding.couple_names as string,
    weddingColor: wedding.wedding_color as string,
    weddingColorSecondary: isPaidPlan(planId)
      ? (wedding.wedding_color_secondary as string | null)
      : null,
    moduleEnabled,
  }
}
