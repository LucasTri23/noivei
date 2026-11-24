import { isStoryLayout, type StoryLayout } from '@/lib/site/story/story-layouts'
import type { Json } from '@/types/database'

// Shape tipado do JSON livre salvo em `site_config.content`. Usado tanto pelo
// editor autenticado (/site) quanto pela renderização pública (/[slug]).
export interface SiteContent {
  hero_subtitle?: string
  story_heading?: string
  gallery_heading?: string
  envelope_caption?: string
  opening_hint?: string
  envelope_monogram?: string
  cover_title?:     string
  our_story?:       string
  story_photo_url?: string
  ceremony_info?:   string
  reception_info?:  string
  gallery_urls?:    string[]
  custom_message?:  string
  dress_code?:      string
  /** Apresentação escolhida para Nossa História; ausente = apresentação original do estilo. */
  story_layout?:    StoryLayout
  /**
   * Formatação Markdown ativada explicitamente pelo casal. Ausente/false = os
   * textos continuam exibidos como texto simples (sites existentes intactos).
   */
  rich_text?:       boolean
  /** Oculta a seção de confirmação de presença do site público. Ausente = visível. */
  hide_rsvp?:       boolean
  /** Oculta a lista de presentes do site público. Ausente = visível (quando há itens). */
  hide_gifts?:      boolean
}

/** Normaliza o JSON livre de `site_config.content` para o shape tipado — ignora chaves desconhecidas ou malformadas. */
export function parseSiteContent(raw: Record<string, Json | undefined> | null | undefined): SiteContent {
  if (!raw) return {}

  const content: SiteContent = {}
  for (const key of ['hero_subtitle', 'story_heading', 'gallery_heading', 'envelope_caption', 'opening_hint', 'envelope_monogram'] as const) {
    if (typeof raw[key] === 'string') content[key] = raw[key]
  }
  if (typeof raw.cover_title === 'string') content.cover_title = raw.cover_title
  if (typeof raw.our_story === 'string') content.our_story = raw.our_story
  if (typeof raw.story_photo_url === 'string') content.story_photo_url = raw.story_photo_url
  if (typeof raw.ceremony_info === 'string') content.ceremony_info = raw.ceremony_info
  if (typeof raw.reception_info === 'string') content.reception_info = raw.reception_info
  if (typeof raw.custom_message === 'string') content.custom_message = raw.custom_message
  if (typeof raw.dress_code === 'string') content.dress_code = raw.dress_code
  if (isStoryLayout(raw.story_layout)) content.story_layout = raw.story_layout
  if (raw.rich_text === true) content.rich_text = true
  if (raw.hide_rsvp === true) content.hide_rsvp = true
  if (raw.hide_gifts === true) content.hide_gifts = true
  if (Array.isArray(raw.gallery_urls)) {
    content.gallery_urls = raw.gallery_urls.filter((url): url is string => typeof url === 'string')
  }

  return content
}
