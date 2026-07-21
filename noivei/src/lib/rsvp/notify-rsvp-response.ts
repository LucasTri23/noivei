import type { SupabaseClient } from '@supabase/supabase-js'

import { isPaidPlan } from '@/constants/plans'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { sendEmail } from '@/lib/email/send-email'
import { rsvpResponseTemplate, type RsvpEmailStatus } from '@/lib/email/templates/rsvp-response-template'

interface NotifyRsvpResponseParams {
  supabase:  SupabaseClient
  weddingId: string
  guestName: string
  status:    RsvpEmailStatus
}

/**
 * Avisa por e-mail o dono do casamento sobre uma resposta de RSVP (confirmado ou
 * recusado). Recurso Premium: só dispara se o casamento tiver plano pago ativo e
 * o dono não tiver desativado `profiles.notify_rsvp` (default true, mesmo padrão
 * usado nos banners do dashboard).
 *
 * Best-effort por natureza: chamada pelo PATCH de rsvp/[token]/route.ts dentro de
 * `after()`, ou seja, já depois da resposta ter sido enviada ao convidado — uma
 * falha aqui nunca deve (e nunca pode, estruturalmente) impedir o RSVP de já ter
 * sido salvo. Erros são só logados.
 */
export async function notifyRsvpResponse({ supabase, weddingId, guestName, status }: NotifyRsvpResponseParams): Promise<void> {
  try {
    const { data: wedding } = await supabase
      .from('weddings')
      .select('user_id, couple_names')
      .eq('id', weddingId)
      .maybeSingle()

    if (!wedding) return

    const userId = wedding.user_id as string

    const planId = await resolveWeddingPlanId(supabase, weddingId)
    if (!isPaidPlan(planId)) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('notify_rsvp')
      .eq('id', userId)
      .maybeSingle()

    const notifyRsvp = (profile?.notify_rsvp as boolean | undefined) ?? true
    if (!notifyRsvp) return

    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const ownerEmail = userData.user?.email
    if (!ownerEmail) return

    const { subject, html } = rsvpResponseTemplate({
      coupleNames: wedding.couple_names as string,
      guestName,
      status,
    })

    await sendEmail({ to: ownerEmail, subject, html })
  } catch (error) {
    console.error('[rsvp] falha ao enviar e-mail de notificação de RSVP:', error)
  }
}
