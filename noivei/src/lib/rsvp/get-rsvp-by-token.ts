import type { SupabaseClient } from '@supabase/supabase-js'

import type { GuestStatus } from '@/types/database'

// Dados mínimos expostos publicamente no fluxo de RSVP — nunca vazar
// e-mail/telefone do convidado nem dados internos do casamento.
export interface RsvpInfo {
  guest: {
    name:   string
    status: GuestStatus
  }
  wedding: {
    couple_names: string
    wedding_date: string | null
    venue:        string | null
    city:         string | null
  }
}

/** Busca o convidado pelo rsvp_token (requer client service role — RLS não cobre acesso anônimo). */
export async function getRsvpByToken(
  supabase: SupabaseClient,
  token:    string,
): Promise<RsvpInfo | null> {
  const { data: guest, error } = await supabase
    .from('guests')
    .select('name, status, wedding_id')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (error || !guest) return null

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names, wedding_date, venue, city')
    .eq('id', guest.wedding_id as string)
    .is('deleted_at', null)
    .maybeSingle()

  if (!wedding) return null

  return {
    guest: {
      name:   guest.name as string,
      status: guest.status as GuestStatus,
    },
    wedding: {
      couple_names: wedding.couple_names as string,
      wedding_date: (wedding.wedding_date as string | null) ?? null,
      venue:        (wedding.venue as string | null) ?? null,
      city:         (wedding.city as string | null) ?? null,
    },
  }
}
