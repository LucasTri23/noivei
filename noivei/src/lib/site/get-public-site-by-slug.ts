import type { SupabaseClient } from '@supabase/supabase-js'

import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import type { Json } from '@/types/database'

// Dados mínimos expostos publicamente no site do casal — nunca vazar
// user_id, e-mail/telefone do casal ou de convidados.
export interface PublicSiteInfo {
  wedding: {
    couple_names: string
    wedding_date: string | null
    venue:        string | null
    city:         string | null
    wedding_color:           string
    wedding_color_secondary: string
  }
  content:              SiteContent
  cover_photo_url:      string | null
  cover_photo_position: number
  gifts: {
    id:           string
    name:         string
    description:  string | null
    price_cents:  number | null
    store_url:    string | null
    image_url:    string | null
    is_purchased: boolean
  }[]
}

/** Busca o site publicado pelo slug (requer client service role — RLS não cobre acesso anônimo). */
export async function getPublicSiteBySlug(
  supabase: SupabaseClient,
  slug:     string,
): Promise<PublicSiteInfo | null> {
  const { data: site, error } = await supabase
    .from('site_config')
    .select('wedding_id, content, cover_photo_url, cover_photo_position')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  // Site inexistente ou não publicado: mesmo tratamento (404) para não vazar existência
  if (error || !site) return null

  const weddingId = site.wedding_id as string

  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names, wedding_date, venue, city, wedding_color, wedding_color_secondary')
    .eq('id', weddingId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!wedding) return null

  const { data: gifts } = await supabase
    .from('gift_registry_items')
    .select('id, name, description, price_cents, store_url, image_url, is_purchased')
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return {
    wedding: {
      couple_names: wedding.couple_names as string,
      wedding_date: (wedding.wedding_date as string | null) ?? null,
      venue:        (wedding.venue as string | null) ?? null,
      city:         (wedding.city as string | null) ?? null,
      wedding_color:           wedding.wedding_color as string,
      wedding_color_secondary: wedding.wedding_color_secondary as string,
    },
    content:              parseSiteContent(site.content as Record<string, Json | undefined> | null),
    cover_photo_url:      (site.cover_photo_url as string | null) ?? null,
    cover_photo_position: (site.cover_photo_position as number | null) ?? 50,
    gifts:                (gifts ?? []) as PublicSiteInfo['gifts'],
  }
}
