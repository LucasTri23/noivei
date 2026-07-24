import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import { parseSiteContent } from '@/lib/site/site-content'
import type { GuestStatus, Json } from '@/types/database'

// Dados mínimos expostos publicamente no fluxo de RSVP — nunca vazar e-mail/telefone
// do convidado nem dados internos do casamento. O telefone NUNCA aparece aqui de
// propósito: ele é usado só no PATCH pra conferir se quem está respondendo digitou
// o mesmo número que o casal cadastrou (ver src/lib/rsvp/normalize-phone.ts) — se
// devolvêssemos o telefone aqui pra pré-preencher o campo, qualquer um que abrisse
// o link (vazado ou reencaminhado) veria o número certo e a verificação não serviria
// pra nada.
export interface RsvpInfo {
  guest: {
    name:            string
    status:          GuestStatus
    // Quantas pessoas o convite cobre (definido pelo casal) — seguro expor, é só um
    // número; o formulário usa pra limitar quantos acompanhantes podem ser informados.
    party_size:      number
  }
  wedding: {
    couple_names: string
    wedding_date: string | null
    venue:        string | null
    city:         string | null
    // Só preenchido no plano pago — personalização de cor é recurso Premium, o
    // Gratuito nunca deve ver o painel de destaque saindo do marrom padrão.
    wedding_color_secondary: string | null
    // Slug do site público, só quando publicado — usado pra redirecionar o convidado
    // pra lá depois de confirmar presença. null tanto se o casal nunca criou o site
    // quanto se criou mas não publicou; os dois casos são "sem site pra redirecionar".
    site_slug: string | null
    // Vem do mesmo site_config.content do site público (ver src/lib/site/site-content.ts)
    // — null se o casal nunca preencheu, independente de o site estar publicado ou não.
    dress_code: string | null
  }
}

/** Busca o convidado pelo rsvp_token (requer client service role — RLS não cobre acesso anônimo). */
export async function getRsvpByToken(
  supabase: SupabaseClient,
  token:    string,
): Promise<RsvpInfo | null> {
  const { data: guest, error } = await supabase
    .from('guests')
    .select('name, status, wedding_id, party_size')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (error || !guest) return null

  const weddingId = guest.wedding_id as string

  const [{ data: wedding }, { data: site }, planId] = await Promise.all([
    supabase
      .from('weddings')
      .select('couple_names, wedding_date, venue, city, wedding_color_secondary')
      .eq('id', weddingId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('site_config')
      .select('slug, content')
      .eq('wedding_id', weddingId)
      .eq('published', true)
      .maybeSingle(),
    resolveWeddingPlanId(supabase, weddingId),
  ])

  if (!wedding) return null

  return {
    guest: {
      name:       guest.name as string,
      status:     guest.status as GuestStatus,
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
      site_slug: (site?.slug as string | null) ?? null,
      dress_code: parseSiteContent(site?.content as Record<string, Json | undefined> | null | undefined).dress_code ?? null,
    },
  }
}
