import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import type { WeddingInviteStatus } from '@/types/database'

// Dados mínimos expostos publicamente pelo link de convite — nunca vazar o id
// interno do convite nem dados do casamento além do nome do casal (mesmo cuidado de
// exposição mínima do RSVP, ver src/lib/rsvp/get-rsvp-by-token.ts).
export interface InviteInfo {
  weddingCoupleNames: string
  status:             WeddingInviteStatus
  expired:            boolean
  // Só preenchido no plano pago — personalização de cor é recurso Premium, o
  // Gratuito nunca deve ver o painel de destaque saindo do marrom padrão.
  weddingColorSecondary: string | null
}

/** Busca o convite pelo token (requer client service role — RLS não cobre acesso anônimo). */
export async function getInviteByToken(
  supabase: SupabaseClient,
  token:    string,
): Promise<InviteInfo | null> {
  const { data: invite, error } = await supabase
    .from('wedding_invites')
    .select('status, expires_at, wedding_id')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return null

  const weddingId = invite.wedding_id as string

  const [{ data: wedding }, planId] = await Promise.all([
    supabase
      .from('weddings')
      .select('couple_names, wedding_color_secondary')
      .eq('id', weddingId)
      .is('deleted_at', null)
      .maybeSingle(),
    resolveWeddingPlanId(supabase, weddingId),
  ])

  if (!wedding) return null

  return {
    weddingCoupleNames: wedding.couple_names as string,
    status:             invite.status as WeddingInviteStatus,
    expired:            new Date(invite.expires_at as string).getTime() < Date.now(),
    weddingColorSecondary: isPaidPlan(planId)
      ? (wedding.wedding_color_secondary as string | null)
      : null,
  }
}
