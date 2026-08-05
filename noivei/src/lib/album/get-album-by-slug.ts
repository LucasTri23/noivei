import type { SupabaseClient } from '@supabase/supabase-js'

import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'

export interface AlbumInfo {
  weddingId:    string
  coupleNames:  string
  // yyyy-mm-dd (coluna DATE) ou null se o casal ainda não definiu a data —
  // usado por isAlbumUploadWindowOpen pra travar cadastro/upload à janela certa
  // (dia do casamento + dia seguinte).
  weddingDate:  string | null
  weddingColor: string
  // Personalização de cor é recurso pago — Gratuito nunca sobrescreve o
  // dourado padrão, mesmo critério já usado no RSVP público (ver
  // src/lib/rsvp/get-rsvp-by-token.ts).
  weddingColorSecondary: string | null
  // false tanto pra "módulo nunca contratado" quanto pra "admin desligou" —
  // as rotas de escrita (register/photos/gallery) tratam isso IDENTICAMENTE a
  // slug inexistente (mesmo 404 genérico); só a página pública distingue pra
  // mostrar "recurso não disponível" em vez de "mural não encontrado".
  moduleEnabled: boolean
}

/**
 * Resolve o casamento a partir do slug do SITE PÚBLICO do casal (site_config.slug,
 * o mesmo usado em /[slug]) — requer client service role, RLS não cobre acesso
 * anônimo. O mural depende do casal já ter publicado o site (published = true):
 * diferente do antigo album_token (removido, nunca chegou a existir em produção —
 * ver migration 20260803000001), este identificador é compartilhado com o site,
 * não é mais gerado à parte. Retorna null quando o slug não existe, o site não
 * está publicado, ou o casamento foi soft-deletado; módulo desabilitado é
 * retornado como `moduleEnabled: false`, não como null (ver comentário em AlbumInfo).
 */
export async function getAlbumBySlug(
  supabase: SupabaseClient,
  slug:     string,
): Promise<AlbumInfo | null> {
  const { data: site, error } = await supabase
    .from('site_config')
    .select('wedding_id, weddings!inner(id, couple_names, wedding_date, wedding_color, wedding_color_secondary, deleted_at)')
    .eq('slug', slug)
    .eq('published', true)
    .is('weddings.deleted_at', null)
    .maybeSingle()

  if (error || !site) return null

  const wedding = site.weddings as unknown as {
    id: string; couple_names: string; wedding_date: string | null; wedding_color: string; wedding_color_secondary: string
  }
  const weddingId = wedding.id

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
    coupleNames:  wedding.couple_names,
    weddingDate:  wedding.wedding_date,
    weddingColor: wedding.wedding_color,
    weddingColorSecondary: isPaidPlan(planId)
      ? wedding.wedding_color_secondary
      : null,
    moduleEnabled,
  }
}
