import type { Json } from '@/types/database'

// Um capítulo narrativo da seção "Nossa história" (ex.: "Onde tudo começou", "O pedido de
// namoro") — substitui o texto único antigo (`our_story`) por vários blocos com título
// próprio, cadastrados e reordenados pelo casal no editor. Ver `parseStoryChapters` para a
// regra de retrocompatibilidade com `our_story`.
export interface StoryChapter {
  id:    string
  title: string
  body:  string
  date?: string
}

// Shape tipado do JSON livre salvo em `site_config.content`. Usado tanto pelo
// editor autenticado (/site) quanto pela renderização pública (/[slug]).
export interface SiteContent {
  cover_title?:    string
  our_story?:      string
  story_chapters?: StoryChapter[]
  ceremony_info?:  string
  reception_info?: string
  gallery_urls?:   string[]
  custom_message?: string
}

function parseStoryChapters(raw: Json | undefined): StoryChapter[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const chapters = raw
    .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .filter((item) => typeof item.id === 'string' && typeof item.title === 'string' && typeof item.body === 'string')
    .map((item): StoryChapter => ({
      id:    item.id as string,
      title: item.title as string,
      body:  item.body as string,
      ...(typeof item.date === 'string' && item.date ? { date: item.date } : {}),
    }))

  return chapters.length > 0 ? chapters : undefined
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
  if (Array.isArray(raw.gallery_urls)) {
    content.gallery_urls = raw.gallery_urls.filter((url): url is string => typeof url === 'string')
  }
  const storyChapters = parseStoryChapters(raw.story_chapters)
  if (storyChapters) content.story_chapters = storyChapters

  return content
}
