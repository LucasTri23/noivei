import type { SupabaseClient } from '@supabase/supabase-js'

import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'

// Dados mínimos expostos na página pública do ingresso — mesmo espírito de
// get-rsvp-by-token.ts (nunca telefone/e-mail do convidado). Só existe ingresso pra
// quem já confirmou presença (ver getTicketByToken abaixo), então status nem
// precisa ser devolvido aqui.
export interface TicketInfo {
  guest: {
    name:       string
    party_size: number
  }
  wedding: {
    couple_names: string
    wedding_date: string | null
    venue:        string | null
    city:         string | null
    // Só preenchido no plano pago, mesmo critério de get-rsvp-by-token.ts.
    wedding_color_secondary: string | null
  }
}

/**
 * Busca o ingresso (ticket de check-in) pelo rsvp_token — requer client service
 * role, RLS não cobre acesso anônimo (mesmo motivo de getRsvpByToken).
 *
 * Só devolve dado se o convidado já confirmou presença (`status === 'confirmado'`)
 * — pendente/recusado/token inexistente viram o MESMO `null` pro chamador, que já
 * trata todos como "ingresso indisponível" sem diferenciar o motivo (não vazar se
 * um token existe mas ainda não confirmou, por exemplo).
 */
export async function getTicketByToken(
  supabase: SupabaseClient,
  token:    string,
): Promise<TicketInfo | null> {
  const { data: guest, error } = await supabase
    .from('guests')
    .select('name, status, wedding_id, party_size')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (error || !guest) return null
  if (guest.status !== 'confirmado') return null

  const weddingId = guest.wedding_id as string

  const [{ data: wedding }, planId] = await Promise.all([
    supabase
      .from('weddings')
      .select('couple_names, wedding_date, venue, city, wedding_color_secondary')
      .eq('id', weddingId)
      .is('deleted_at', null)
      .maybeSingle(),
    resolveWeddingPlanId(supabase, weddingId),
  ])

  if (!wedding) return null

  return {
    guest: {
      name:       guest.name as string,
      party_size: guest.party_size as number,
    },
    wedding: {
      couple_names: wedding.couple_names as string,
      wedding_date: (wedding.wedding_date as string | null) ?? null,
      venue:        (wedding.venue as string | null) ?? null,
      city:         (wedding.city as string | null) ?? null,
      wedding_color_secondary: isPaidPlan(planId)
        ? (wedding.wedding_color_secondary as string | null)
        : null,
    },
  }
}
