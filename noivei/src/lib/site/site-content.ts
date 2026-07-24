import type { Json } from '@/types/database'

// Shape tipado do JSON livre salvo em `site_config.content`. Usado tanto pelo
// editor autenticado (/site) quanto pela renderização pública (/[slug]).
export interface SiteContent {
  cover_title?:    string
  our_story?:      string
  ceremony_info?:  string
  reception_info?: string
  gallery_urls?:   string[]
  custom_message?: string
  dress_code?:     string
}

/** Normaliza o JSON livre de `site_config.content` para o shape tipado — ignora chaves desconhecidas ou malformadas. */
export function parseSiteContent(raw: Record<string, Json | undefined> | null | undefined): SiteContent {
  if (!raw) return {}

  const content: SiteContent = {}
  if (typeof raw.cover_title === 'string') content.cover_title = raw.cover_title
  if (typeof raw.our_story === 'string') content.our_story = raw.our_story
  if (typeof raw.ceremony_info === 'string') content.ceremony_info = raw.ceremony_info
  if (typeof raw.reception_info === 'string') content.reception_info = raw.reception_info
  if (typeof raw.custom_message === 'string') content.custom_message = raw.custom_message
  if (typeof raw.dress_code === 'string') content.dress_code = raw.dress_code
  if (Array.isArray(raw.gallery_urls)) {
    content.gallery_urls = raw.gallery_urls.filter((url): url is string => typeof url === 'string')
  }

  return content
}
