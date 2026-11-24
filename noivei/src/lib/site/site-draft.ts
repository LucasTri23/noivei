import { SiteSlugSchema } from '@/lib/api/validation/site.schema'
import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import {
  siteFeatureAccess, validateCustomization,
  type SiteFaqItem, type SiteLodgingItem, type SitePalette, type SiteSectionsConfig,
} from '@/lib/site/customization'
import { SITE_TEMPLATE_CONFIG, type StyleField } from '@/lib/site/template-config'
import { allowsSiteMonogram } from '@/lib/site/templates'
import type { PlanId } from '@/constants/plans'
import type { SiteConfig, SiteTemplate } from '@/types/database'

/**
 * Tudo o que o editor do site deixa o casal mudar antes de clicar em "Salvar".
 * O editor guarda duas cópias — a última salva e o rascunho — e a barra de
 * alterações aparece sempre que as duas diferem, em qualquer aba.
 */
export interface SiteDraft {
  slug:               string
  published:          boolean
  template:           SiteTemplate
  coverPhotoUrl:      string | null
  coverPhotoPosition: number
  coverPhotoZoom:     number
  content:            SiteContent
}

export type EditorSectionId = 'capa' | 'aparencia' | 'secoes' | 'historia' | 'cerimonia' | 'informacoes' | 'rsvp' | 'presentes' | 'galeria'

export const TEXT_CONTENT_KEYS = [
  'cover_title', 'our_story', 'story_photo_url', 'ceremony_info', 'reception_info', 'custom_message', 'dress_code',
  'hero_subtitle', 'story_heading', 'gallery_heading', 'envelope_caption', 'opening_hint', 'envelope_monogram',
] as const

const STYLE_FIELD_KEYS: StyleField[] = ['hero_subtitle', 'story_heading', 'gallery_heading', 'envelope_caption', 'opening_hint', 'envelope_monogram']

export function draftFromConfig(site: SiteConfig): SiteDraft {
  return {
    slug:               site.slug,
    published:          site.published,
    template:           site.template,
    coverPhotoUrl:      site.cover_photo_url,
    coverPhotoPosition: site.cover_photo_position,
    coverPhotoZoom:     site.cover_photo_zoom,
    content:            parseSiteContent(site.content),
  }
}

/** Forma canônica do conteúdo: textos aparados, campos vazios removidos e ordem de chaves fixa. */
export function normalizeContent(content: SiteContent): SiteContent {
  const next: SiteContent = {}
  for (const key of TEXT_CONTENT_KEYS) {
    const value = content[key]?.trim()
    if (value) next[key] = value
  }
  if (content.gallery_urls && content.gallery_urls.length > 0) next.gallery_urls = [...content.gallery_urls]
  if (content.story_layout) next.story_layout = content.story_layout
  if (content.rich_text) next.rich_text = true
  if (content.hide_rsvp) next.hide_rsvp = true
  if (content.hide_gifts) next.hide_gifts = true
  if (content.font_pair) next.font_pair = content.font_pair
  const palette = normalizePalette(content.palette)
  if (palette) next.palette = palette
  const sections = normalizeSections(content.sections)
  if (sections) next.sections = sections
  const faq = normalizeFaq(content.faq)
  if (faq) next.faq = faq
  const lodging = normalizeLodging(content.lodging)
  if (lodging) next.lodging = lodging
  if (content.monogram_image_url) next.monogram_image_url = content.monogram_image_url
  return next
}

function normalizePalette(palette: SitePalette | undefined): SitePalette | undefined {
  if (!palette) return undefined
  const next: SitePalette = {}
  if (palette.accent) next.accent = palette.accent.toUpperCase()
  if (palette.tone) next.tone = palette.tone
  if (palette.seal) next.seal = palette.seal
  return Object.keys(next).length > 0 ? next : undefined
}

function normalizeSections(sections: SiteSectionsConfig | undefined): SiteSectionsConfig | undefined {
  if (!sections) return undefined
  const next: SiteSectionsConfig = {}
  if (sections.order && sections.order.length > 0) next.order = [...new Set(sections.order)]
  if (sections.hidden && sections.hidden.length > 0) next.hidden = [...new Set(sections.hidden)]
  return next.order || next.hidden ? next : undefined
}

// Itens totalmente vazios (o casal clicou em "adicionar" e não preencheu) somem;
// itens pela metade ficam para a validação apontar o que falta.
function normalizeFaq(faq: SiteFaqItem[] | undefined): SiteFaqItem[] | undefined {
  const items = (faq ?? [])
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question || item.answer)
  return items.length > 0 ? items : undefined
}

const LODGING_OPTIONAL_KEYS = ['address', 'map_url', 'phone', 'notes', 'discount_code'] as const

function normalizeLodging(lodging: SiteLodgingItem[] | undefined): SiteLodgingItem[] | undefined {
  const items: SiteLodgingItem[] = []
  for (const item of lodging ?? []) {
    const next: SiteLodgingItem = { name: item.name.trim() }
    for (const key of LODGING_OPTIONAL_KEYS) {
      const value = item[key]?.trim()
      if (value) next[key] = value
    }
    if (next.name || Object.keys(next).length > 1) items.push(next)
  }
  return items.length > 0 ? items : undefined
}

const SECTION_CONTENT_KEYS: Record<EditorSectionId, (keyof SiteContent)[]> = {
  capa:        ['cover_title', 'monogram_image_url', ...STYLE_FIELD_KEYS],
  aparencia:   ['font_pair', 'palette'],
  secoes:      ['sections'],
  informacoes: ['faq', 'lodging'],
  historia:  ['our_story', 'custom_message', 'story_photo_url', 'story_layout', 'rich_text'],
  cerimonia: ['ceremony_info', 'reception_info', 'dress_code'],
  rsvp:      ['hide_rsvp'],
  presentes: ['hide_gifts'],
  galeria:   ['gallery_urls'],
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Quais abas têm alterações ainda não salvas. */
export function dirtySections(draft: SiteDraft, saved: SiteDraft): Set<EditorSectionId> {
  const dirty = new Set<EditorSectionId>()
  const a = normalizeContent(draft.content)
  const b = normalizeContent(saved.content)

  for (const [section, keys] of Object.entries(SECTION_CONTENT_KEYS) as [EditorSectionId, (keyof SiteContent)[]][]) {
    if (keys.some((key) => !sameValue(a[key], b[key]))) dirty.add(section)
  }
  const capaFields: (keyof SiteDraft)[] = ['published', 'template', 'coverPhotoUrl', 'coverPhotoPosition', 'coverPhotoZoom']
  if (capaFields.some((key) => draft[key] !== saved[key]) || draft.slug.trim() !== saved.slug) dirty.add('capa')
  return dirty
}

/** URLs de fotos que o rascunho usa — o que estiver fora daqui pode sair do armazenamento depois de salvar. */
export function referencedPhotoUrls(draft: SiteDraft): Set<string> {
  const urls = new Set<string>(draft.content.gallery_urls ?? [])
  if (draft.coverPhotoUrl) urls.add(draft.coverPhotoUrl)
  if (draft.content.story_photo_url) urls.add(draft.content.story_photo_url)
  if (draft.content.monogram_image_url) urls.add(draft.content.monogram_image_url)
  return urls
}

export interface SitePatchBody {
  slug?:                 string
  published?:            boolean
  template?:             SiteTemplate
  cover_photo_url?:      string | null
  cover_photo_position?: number
  cover_photo_zoom?:     number
  content?:              SiteContent
}

export type BuildSitePatchResult =
  | { ok: true; body: SitePatchBody | null }
  | { ok: false; message: string; section: EditorSectionId }

/**
 * Monta o PATCH com só o que mudou. Campos de estilo que o estilo escolhido não usa
 * (ex.: o casal escreveu num campo do Editorial e trocou para o Clássico) voltam ao
 * valor salvo — a API recusaria e eles não apareceriam no site de qualquer forma.
 */
export function buildSitePatch(draft: SiteDraft, saved: SiteDraft, planId: PlanId): BuildSitePatchResult {
  const body: SitePatchBody = {}

  if (draft.slug.trim() !== saved.slug) {
    const parsed = SiteSlugSchema.safeParse(draft.slug)
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.', section: 'capa' }
    body.slug = parsed.data
  }
  if (draft.published !== saved.published) body.published = draft.published
  if (draft.template !== saved.template) body.template = draft.template
  if (draft.coverPhotoUrl !== saved.coverPhotoUrl) body.cover_photo_url = draft.coverPhotoUrl
  if (draft.coverPhotoPosition !== saved.coverPhotoPosition) body.cover_photo_position = draft.coverPhotoPosition
  if (draft.coverPhotoZoom !== saved.coverPhotoZoom) body.cover_photo_zoom = draft.coverPhotoZoom

  const content = normalizeContent(draft.content)
  const savedContent = normalizeContent(saved.content)
  const allowedStyleFields = new Set<StyleField>(SITE_TEMPLATE_CONFIG[draft.template].fields.map((field) => field.key))
  if (allowsSiteMonogram(planId)) allowedStyleFields.add('envelope_monogram')
  for (const key of STYLE_FIELD_KEYS) {
    if (allowedStyleFields.has(key)) continue
    if (savedContent[key]) content[key] = savedContent[key]
    else delete content[key]
  }

  // Recursos que o plano não libera voltam ao valor salvo (o editor já os desabilita;
  // isto só evita mandar à API algo que ela recusaria).
  const access = siteFeatureAccess(planId)
  const keepSaved = <K extends keyof SiteContent>(key: K) => {
    if (savedContent[key] !== undefined) content[key] = savedContent[key]
    else delete content[key]
  }
  if (!access.monogram) keepSaved('monogram_image_url')
  if (!access.fontPairs) keepSaved('font_pair')
  if (!access.lodging) keepSaved('lodging')
  if (content.palette && (!access.tone || !access.seal)) {
    const palette: SitePalette = { ...content.palette }
    if (!access.tone) { if (savedContent.palette?.tone) palette.tone = savedContent.palette.tone; else delete palette.tone }
    if (!access.seal) { if (savedContent.palette?.seal) palette.seal = savedContent.palette.seal; else delete palette.seal }
    content.palette = normalizePalette(palette)
    if (!content.palette) delete content.palette
  }

  const appearanceError = validateCustomization({ font_pair: content.font_pair, palette: content.palette })
  if (appearanceError && !sameValue([content.font_pair, content.palette], [savedContent.font_pair, savedContent.palette])) {
    return { ok: false, section: 'aparencia', message: appearanceError }
  }
  const infoError = validateCustomization({ faq: content.faq, lodging: content.lodging })
  if (infoError && !sameValue([content.faq, content.lodging], [savedContent.faq, savedContent.lodging])) {
    return { ok: false, section: 'informacoes', message: infoError }
  }

  const galleryChanged = !sameValue(content.gallery_urls, savedContent.gallery_urls)
  const galleryLimit = SITE_TEMPLATE_CONFIG[draft.template].galleryLimit
  if (galleryChanged && galleryLimit !== null && (content.gallery_urls?.length ?? 0) > galleryLimit) {
    return {
      ok: false,
      section: 'galeria',
      message: `O estilo ${SITE_TEMPLATE_CONFIG[draft.template].label} aceita até ${galleryLimit} fotos na galeria. Remova algumas para salvar.`,
    }
  }

  if (!sameValue(normalizeContent(content), savedContent)) body.content = normalizeContent(content)

  return { ok: true, body: Object.keys(body).length > 0 ? body : null }
}

/** Seção com conteúdo preenchido — alimenta o ✓ da navegação do editor. */
export function sectionIsFilled(section: EditorSectionId, draft: SiteDraft, giftCount: number): boolean {
  const content = draft.content
  switch (section) {
    case 'capa':        return Boolean(draft.coverPhotoUrl)
    case 'aparencia':   return Boolean(content.font_pair || content.palette)
    case 'secoes':      return Boolean(content.sections)
    case 'informacoes': return Boolean(content.faq?.length || content.lodging?.length)
    case 'historia':  return Boolean(content.our_story?.trim())
    case 'cerimonia': return Boolean(content.ceremony_info?.trim() || content.reception_info?.trim())
    case 'rsvp':      return !content.hide_rsvp
    case 'presentes': return giftCount > 0 && !content.hide_gifts
    case 'galeria':   return (content.gallery_urls?.length ?? 0) > 0
  }
}
