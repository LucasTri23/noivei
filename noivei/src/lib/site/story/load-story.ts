import type { SupabaseClient } from '@supabase/supabase-js'

import { toWeddingPhotoPublicUrl } from '@/lib/site/wedding-photo-storage'
import type { SiteStoryMoment, StoryDatePrecision } from '@/types/database'

import type { StoryData, StoryPhotoInput } from './story-model'

export interface StoryPhotoRecord extends StoryPhotoInput {
  storage_path: string
  size_bytes:   number
}

export interface StoryRecords {
  moments: SiteStoryMoment[]
  photos:  StoryPhotoRecord[]
}

interface StoryPhotoRow {
  photo_id:   string
  moment_id:  string | null
  caption:    string | null
  sort_order: number
}

interface GalleryRow {
  id:           string
  storage_path: string
  size_bytes:   number
  width:        number | null
  height:       number | null
  position_y:   number | null
  fit_contain:  boolean | null
}

/**
 * Momentos e fotos da história de um casamento, já com URL pública.
 * Sempre filtra por wedding_id explicitamente: no site público o client é
 * service role (sem RLS), então o filtro aqui é o que isola os casais.
 */
export async function loadStoryRecords(supabase: SupabaseClient, weddingId: string): Promise<StoryRecords> {
  const [{ data: momentRows, error: momentsError }, { data: photoRows, error: photosError }] = await Promise.all([
    supabase
      .from('site_story_moments')
      .select('id, wedding_id, title, description, happened_on, date_precision, sort_order, created_at, updated_at')
      .eq('wedding_id', weddingId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('site_story_photos')
      .select('photo_id, moment_id, caption, sort_order')
      .eq('wedding_id', weddingId)
      .order('sort_order', { ascending: true }),
  ])

  // Falha de leitura (ex.: migration ainda não aplicada) = sem conteúdo novo;
  // o site cai na apresentação original em vez de quebrar.
  if (momentsError || photosError) return { moments: [], photos: [] }

  const storyPhotos = (photoRows ?? []) as StoryPhotoRow[]
  if (storyPhotos.length === 0) return { moments: (momentRows ?? []) as SiteStoryMoment[], photos: [] }

  const { data: galleryRows } = await supabase
    .from('wedding_gallery_photos')
    .select('id, storage_path, size_bytes, width, height, position_y, fit_contain')
    .eq('wedding_id', weddingId)
    .eq('purpose', 'story')
    .in('id', storyPhotos.map((photo) => photo.photo_id))

  const galleryById = new Map(((galleryRows ?? []) as GalleryRow[]).map((row) => [row.id, row]))

  const photos: StoryPhotoRecord[] = []
  for (const photo of storyPhotos) {
    const gallery = galleryById.get(photo.photo_id)
    if (!gallery) continue
    photos.push({
      id:           photo.photo_id,
      url:          toWeddingPhotoPublicUrl(supabase, gallery.storage_path),
      storage_path: gallery.storage_path,
      size_bytes:   gallery.size_bytes,
      caption:      photo.caption,
      moment_id:    photo.moment_id,
      sort_order:   photo.sort_order,
      width:        gallery.width,
      height:       gallery.height,
      position_y:   gallery.position_y ?? 50,
      fit_contain:  gallery.fit_contain ?? false,
    })
  }

  return { moments: (momentRows ?? []) as SiteStoryMoment[], photos }
}

/** Recorte público (sem storage_path/tamanho) para o modelo de renderização. */
export function toStoryData(records: StoryRecords): StoryData {
  return {
    moments: records.moments.map((m) => ({
      id: m.id, title: m.title, description: m.description, happened_on: m.happened_on,
      date_precision: m.date_precision as StoryDatePrecision, sort_order: m.sort_order,
    })),
    photos: records.photos.map((p) => ({
      id: p.id, url: p.url, caption: p.caption, moment_id: p.moment_id, sort_order: p.sort_order,
      width: p.width, height: p.height, position_y: p.position_y, fit_contain: p.fit_contain,
    })),
  }
}
