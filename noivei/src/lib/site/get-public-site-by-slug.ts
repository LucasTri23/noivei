import { limitTemplateGallery } from '@/lib/site/template-config'
import { allowsSiteMonogram, resolveSiteTemplate } from '@/lib/site/templates'
import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { toGiftPhotoPublicUrl } from '@/lib/gifts/gift-photo-storage'
import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import { loadStoryRecords, toStoryData } from '@/lib/site/story/load-story'
import { resolveStoryLayout } from '@/lib/site/story/story-layouts'
import { buildStoryView, type StoryView } from '@/lib/site/story/story-model'
import { toWeddingPhotoPublicUrl } from '@/lib/site/wedding-photo-storage'
import type { GiftRegistryType, Json, SiteTemplate } from '@/types/database'

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
  // Nossa História já resolvida (modo efetivo + momentos/fotos ordenados) —
  // { layout: 'legacy' } enquanto o casal não escolher uma apresentação nova.
  story:                StoryView
  cover_photo_url:      string | null
  cover_photo_position: number
  cover_photo_zoom:     number
  // Estilo permitido pelo plano atual.
  template:             SiteTemplate
  // Acesso ao mural de fotos dos convidados.
  albumEnabled:         boolean
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

/**
 * Busca o site publicado pelo slug (requer client service role — RLS não cobre acesso anônimo).
 * `includeUnpublished` só pode ser usado depois de confirmar que quem pede é o próprio
 * casal (pré-visualização do rascunho em /site/previa).
 */
export async function getPublicSiteBySlug(
  supabase: SupabaseClient,
  slug:     string,
  options:  { includeUnpublished?: boolean } = {},
): Promise<PublicSiteInfo | null> {
  let query = supabase
    .from('site_config')
    .select('wedding_id, content, cover_photo_url, cover_photo_position, cover_photo_zoom, template')
    .eq('slug', slug)
  if (!options.includeUnpublished) query = query.eq('published', true)
  const { data: site, error } = await query.maybeSingle()

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

  // A configuração salva é preservada ao fazer downgrade.
  const planId = await resolveWeddingPlanId(supabase, weddingId)
  const { data: albumAccessRow } = await supabase
    .from('plan_module_access')
    .select('enabled')
    .eq('plan_id', planId)
    .eq('module', 'album')
    .maybeSingle()
  const albumEnabled = (albumAccessRow?.enabled as boolean | undefined) ?? true
  const storedTemplate = (site.template as SiteTemplate | null) ?? 'classic'
  const template = resolveSiteTemplate(storedTemplate, planId)

  const content = parseSiteContent(site.content as Record<string, Json | undefined> | null)
  if (!allowsSiteMonogram(planId)) delete content.envelope_monogram

  // Lista oculta pelo casal no editor: nem busca os itens (os templates já escondem a
  // seção quando a lista está vazia).
  const { data: gifts } = content.hide_gifts ? { data: [] } : await supabase
    .from('gift_registry_items')
    .select('id, name, description, price_cents, store_url, image_url, image_storage_path, gift_type, is_purchased')
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const galleryPhotos = await resolveGalleryPhotos(supabase, weddingId, content.gallery_urls ?? [], template)

  // Momentos/fotos só são buscados quando o casal escolheu uma apresentação
  // nova — sites que não usam o recurso não fazem nenhuma consulta a mais.
  const story: StoryView = resolveStoryLayout(template, content.story_layout) === 'legacy'
    ? { layout: 'legacy' }
    : buildStoryView(template, content.story_layout, content.our_story, toStoryData(await loadStoryRecords(supabase, weddingId)))

  // Foto enviada do dispositivo: recalcula a URL pública a partir do path a cada leitura
  // (nunca confia num image_url gravado) — mesmo motivo de resolveGalleryPhotos acima.
  const resolvedGifts = ((gifts ?? []) as (PublicSiteInfo['gifts'][number] & { image_storage_path: string | null })[])
    .map(({ image_storage_path, ...gift }) => ({
      ...gift,
      image_url: image_storage_path ? toGiftPhotoPublicUrl(supabase, image_storage_path) : gift.image_url,
    }))

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
    story,
    cover_photo_url:      (site.cover_photo_url as string | null) ?? null,
    cover_photo_position: (site.cover_photo_position as number | null) ?? 50,
    cover_photo_zoom:     (site.cover_photo_zoom as number | null) ?? 0,
    template,
    albumEnabled,
    gifts:                resolvedGifts,
  }
}

// Junta as URLs livres de content.gallery_urls (ordem/fonte da verdade de exibição) com os
// metadados de recorte de wedding_gallery_photos (só existem pra fotos enviadas do
// computador, casadas pela URL pública derivada do storage_path). URL sem correspondência
// (colada manualmente) cai no padrão: centro, sem "contain". Fotos da história
// (purpose = 'story') nunca entram na galeria pública, mesmo que a URL apareça na lista;
// o teto do estilo é aplicado depois desse filtro.
async function resolveGalleryPhotos(
  supabase:    SupabaseClient,
  weddingId:   string,
  galleryUrls: string[],
  template:    SiteTemplate,
): Promise<PublicGalleryPhoto[]> {
  if (galleryUrls.length === 0) return []

  const { data: photoRows } = await supabase
    .from('wedding_gallery_photos')
    .select('storage_path, position_y, fit_contain, purpose')
    .eq('wedding_id', weddingId)

  const metaByUrl = new Map<string, { position_y: number; fit_contain: boolean }>()
  const storyUrls = new Set<string>()
  for (const row of photoRows ?? []) {
    const publicUrl = toWeddingPhotoPublicUrl(supabase, row.storage_path as string)
    if (row.purpose === 'story') {
      storyUrls.add(publicUrl)
      continue
    }
    metaByUrl.set(publicUrl, {
      position_y:  (row.position_y as number | null) ?? 50,
      fit_contain: (row.fit_contain as boolean | null) ?? false,
    })
  }

  return limitTemplateGallery(galleryUrls.filter((url) => !storyUrls.has(url)), template)
    .map((url) => ({ url, ...(metaByUrl.get(url) ?? { position_y: 50, fit_contain: false }) }))
}
