import type { SupabaseClient } from '@supabase/supabase-js'

import type { WeddingInviteStatus } from '@/types/database'

// Dados mínimos expostos publicamente pelo link de convite — nunca vazar o id
// interno do convite nem dados do casamento além do nome do casal (mesmo cuidado de
// exposição mínima do RSVP, ver src/lib/rsvp/get-rsvp-by-token.ts).
export interface InviteInfo {
  weddingCoupleNames: string
  status:             WeddingInviteStatus
  expired:            boolean
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

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names')
    .eq('id', invite.wedding_id as string)
    .is('deleted_at', null)
    .maybeSingle()

  if (!wedding) return null

  return {
    weddingCoupleNames: wedding.couple_names as string,
    status:             invite.status as WeddingInviteStatus,
    expired:            new Date(invite.expires_at as string).getTime() < Date.now(),
  }
}
