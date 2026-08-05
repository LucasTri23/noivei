import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import type { WeddingInviteStatus } from '@/types/database'

// Dados mínimos expostos publicamente pelo link de convite — nunca vazar o id
// interno do convite nem dados do casamento além do nome do casal (mesmo cuidado de
// exposição mínima do RSVP, ver src/lib/rsvp/get-rsvp-by-token.ts). Em especial,
// invited_email (SEC-003) NUNCA é devolvido inteiro aqui — só a versão mascarada
// (maskedInvitedEmail) e um booleano (emailRestricted), pra tela pública poder dar
// uma pista de qual conta usar sem expor o e-mail completo em HTML/URL pública.
export interface InviteInfo {
  weddingCoupleNames: string
  status:             WeddingInviteStatus
  expired:            boolean
  // Só preenchido no plano pago — personalização de cor é recurso Premium, o
  // Gratuito nunca deve ver o painel de destaque saindo do marrom padrão.
  weddingColorSecondary: string | null
  // true quando o convite está travado a um e-mail específico (invited_email preenchido).
  emailRestricted: boolean
  // Versão mascarada do e-mail (ex.: "an***@***.com"), só quando emailRestricted — nunca
  // o e-mail completo.
  maskedInvitedEmail: string | null
  // true quando o convite está travado a um e-mail E o e-mail informado (da conta
  // autenticada, se houver) não bate. `currentUserEmail` ausente/vazio => sempre false
  // aqui (não há base pra comparar ainda; a tela pública mostra o fluxo de login normal).
  emailMismatch: boolean
}

// "ana.silva@gmail.com" -> "an***@***.com" — mostra só os 2 primeiros caracteres do
// usuário e o TLD do domínio, o resto vira asterisco. Dá uma pista de qual conta usar
// sem expor o e-mail completo em HTML/URL pública (a página é servida sem auth).
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'

  const local  = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  const lastDot = domain.lastIndexOf('.')
  const tld = lastDot >= 0 ? domain.slice(lastDot) : ''

  return `${visible}***@***${tld}`
}

/**
 * Busca o convite pelo token (requer client service role — RLS não cobre acesso anônimo).
 * `currentUserEmail` é opcional: quando informado (usuário já autenticado na tela
 * pública de convite), é comparado contra invited_email para computar `emailMismatch`
 * — sem isso, a tela só saberia do descompasso depois de tentar aceitar via API.
 */
export async function getInviteByToken(
  supabase:         SupabaseClient,
  token:            string,
  currentUserEmail?: string | null,
): Promise<InviteInfo | null> {
  const { data: invite, error } = await supabase
    .from('wedding_invites')
    .select('status, expires_at, wedding_id, invited_email')
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

  const invitedEmail = invite.invited_email as string | null
  const normalizedCurrentEmail = currentUserEmail ? currentUserEmail.trim().toLowerCase() : null

  return {
    weddingCoupleNames: wedding.couple_names as string,
    status:             invite.status as WeddingInviteStatus,
    expired:            new Date(invite.expires_at as string).getTime() < Date.now(),
    weddingColorSecondary: isPaidPlan(planId)
      ? (wedding.wedding_color_secondary as string | null)
      : null,
    emailRestricted:    invitedEmail !== null,
    maskedInvitedEmail: invitedEmail ? maskEmail(invitedEmail) : null,
    emailMismatch:      invitedEmail !== null && normalizedCurrentEmail !== null && normalizedCurrentEmail !== invitedEmail,
  }
}
