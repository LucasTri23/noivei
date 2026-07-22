import type { SupabaseClient } from '@supabase/supabase-js'

import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import type { GiftRegistryType, Json } from '@/types/database'

// Foto da galeria com metadados de recorte já resolvidos — position_y/fit_contain vêm de
// wedding_gallery_photos (fotos enviadas do computador); URLs coladas manualmente não têm
// registro correspondente e caem no padrão (centro, sem "contain").
export interface PublicGalleryPhoto {
  url:         string
  position_y:  number
  fit_contain: boolean
}

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
  galleryPhotos:        PublicGalleryPhoto[]
  cover_photo_url:      string | null
  cover_photo_position: number
  gifts: {
    id:           string
    name:         string
    description:  string | null
    price_cents:  number | null
    store_url:    string | null
    image_url:    string | null
    gift_type:    GiftRegistryType
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
    .select('id, name, description, price_cents, store_url, image_url, gift_type, is_purchased')
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const content = parseSiteContent(site.content as Record<string, Json | undefined> | null)
  const galleryPhotos = await resolveGalleryPhotos(supabase, weddingId, content.gallery_urls ?? [])

  return {
    wedding: {
      couple_names: wedding.couple_names as string,
      wedding_date: (wedding.wedding_date as string | null) ?? null,
      venue:        (wedding.venue as string | null) ?? null,
      city:         (wedding.city as string | null) ?? null,
      wedding_color:           wedding.wedding_color as string,
      wedding_color_secondary: wedding.wedding_color_secondary as string,
    },
    content,
    galleryPhotos,
    cover_photo_url:      (site.cover_photo_url as string | null) ?? null,
    cover_photo_position: (site.cover_photo_position as number | null) ?? 50,
    gifts:                (gifts ?? []) as PublicSiteInfo['gifts'],
  }
}

// Junta as URLs livres de content.gallery_urls (ordem/fonte da verdade de exibição) com os
// metadados de recorte de wedding_gallery_photos (só existem pra fotos enviadas do
// computador, casadas pela URL pública derivada do storage_path). URL sem correspondência
// (colada manualmente) cai no padrão: centro, sem "contain".
async function resolveGalleryPhotos(
  supabase:    SupabaseClient,
  weddingId:   string,
  galleryUrls: string[],
): Promise<PublicGalleryPhoto[]> {
  if (galleryUrls.length === 0) return []

  const { data: photoRows } = await supabase
    .from('wedding_gallery_photos')
    .select('storage_path, position_y, fit_contain')
    .eq('wedding_id', weddingId)

  const metaByUrl = new Map<string, { position_y: number; fit_contain: boolean }>()
  for (const row of photoRows ?? []) {
    const publicUrl = supabase.storage.from('wedding-photos').getPublicUrl(row.storage_path as string).data.publicUrl
    metaByUrl.set(publicUrl, {
      position_y:  (row.position_y as number | null) ?? 50,
      fit_contain: (row.fit_contain as boolean | null) ?? false,
    })
  }

  return galleryUrls.map((url) => ({ url, ...(metaByUrl.get(url) ?? { position_y: 50, fit_contain: false }) }))
}
