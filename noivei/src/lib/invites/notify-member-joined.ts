import type { SupabaseClient } from '@supabase/supabase-js'

import { sendEmail } from '@/lib/email/send-email'
import { memberJoinedTemplate } from '@/lib/email/templates/member-joined-template'

interface NotifyMemberJoinedParams {
  supabase:   SupabaseClient
  weddingId:  string
  memberName: string
}

/**
 * Avisa por e-mail o dono do casamento que alguém aceitou um convite e entrou
 * como membro. Diferente das notificações de RSVP/checklist, isso é uma
 * notificação de segurança/consciência situacional (quem tem acesso ao
 * casamento) — dispara em qualquer plano, não só nos pagos. Ainda assim
 * respeita `profiles.notify_members` (default true).
 *
 * Best-effort por natureza: chamada depois do accept de convite já ter sido
 * commitado (wedding_members inserido + wedding_invites marcado accepted) —
 * uma falha aqui nunca deve impedir o usuário de já ter entrado no casamento.
 * Erros são só logados.
 */
export async function notifyMemberJoined({ supabase, weddingId, memberName }: NotifyMemberJoinedParams): Promise<void> {
  try {
    const { data: wedding } = await supabase
      .from('weddings')
      .select('user_id, couple_names')
      .eq('id', weddingId)
      .maybeSingle()

    if (!wedding) return

    const userId = wedding.user_id as string

    const { data: profile } = await supabase
      .from('profiles')
      .select('notify_members')
      .eq('id', userId)
      .maybeSingle()

    const notifyMembers = (profile?.notify_members as boolean | undefined) ?? true
    if (!notifyMembers) return

    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const ownerEmail = userData.user?.email
    if (!ownerEmail) return

    const { subject, html } = memberJoinedTemplate({
      coupleNames: wedding.couple_names as string,
      memberName,
    })

    await sendEmail({ to: ownerEmail, subject, html })
  } catch (error) {
    console.error('[invites] falha ao enviar e-mail de notificação de novo membro:', error)
  }
}
