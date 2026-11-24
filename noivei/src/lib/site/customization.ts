import { isPaidPlan, type PlanId } from '@/constants/plans'
import { deriveWeddingColorScale } from '@/lib/theme/wedding-color'
import type { SiteTemplate } from '@/types/database'

// Personalização do site do casal — fontes, cores, seções, perguntas frequentes,
// hospedagem e monograma em imagem. Regra geral: chave ausente = site exatamente
// como antes. Este módulo não importa nada de servidor/browser para ser usado
// pela API, pelo site público, pelo editor e pelos testes.

/* ───────────────────────── Tipografia ───────────────────────── */

export const SITE_FONT_PAIRS = [
  { id: 'elegante',      label: 'Elegante',      display: 'Playfair Display', body: 'Source Sans 3' },
  { id: 'moderno',       label: 'Moderno',       display: 'Fraunces',         body: 'Inter' },
  { id: 'editorial',     label: 'Editorial',     display: 'Bodoni Moda',      body: 'Jost' },
  { id: 'atemporal',     label: 'Atemporal',     display: 'EB Garamond',      body: 'Montserrat' },
  { id: 'suave',         label: 'Suave',         display: 'Lora',             body: 'Nunito Sans' },
  { id: 'contemporaneo', label: 'Contemporâneo', display: 'DM Serif Display', body: 'DM Sans' },
] as const

export type SiteFontPairId = (typeof SITE_FONT_PAIRS)[number]['id']

export function isSiteFontPair(value: unknown): value is SiteFontPairId {
  return SITE_FONT_PAIRS.some((pair) => pair.id === value)
}

/* ───────────────────────── Cores e acabamento ───────────────────────── */

export const SITE_TONES = ['light', 'cream', 'dark'] as const
export type SiteTone = (typeof SITE_TONES)[number]

export const SITE_TONE_LABELS: Record<SiteTone, string> = { light: 'Claro', cream: 'Creme', dark: 'Escuro' }

export const SEAL_FINISHES = ['gold', 'silver', 'wax', 'wedding'] as const
export type SealFinish = (typeof SEAL_FINISHES)[number]

export const SEAL_FINISH_LABELS: Record<SealFinish, string> = {
  gold: 'Dourado', silver: 'Prata', wax: 'Lacre vermelho', wedding: 'Cor do casamento',
}

export interface SitePalette {
  /** Cor de destaque só do site (substitui a cor principal do casamento nele). */
  accent?: string
  tone?:   SiteTone
  seal?:   SealFinish
}

/** Fundo, superfície e textos de cada tom — mesmas variáveis do app e dos templates premium. */
export interface ToneColors { bg: string; surface: string; fg: string; muted: string; mutedFg: string; border: string }

export const SITE_TONE_COLORS: Record<SiteTone, ToneColors> = {
  light: { bg: '#FFFFFF', surface: '#FAF9F6', fg: '#2A2622', muted: '#F3F1EC', mutedFg: '#665F57', border: '#E6E1D8' },
  cream: { bg: '#F8F1E6', surface: '#FFFBF4', fg: '#3C2818', muted: '#F1E7D7', mutedFg: '#765F4A', border: '#E4D4BE' },
  dark:  { bg: '#17130F', surface: '#221C17', fg: '#F3ECE3', muted: '#1D1813', mutedFg: '#B4A89A', border: '#3A3129' },
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

/* ───────────────────────── Seções ───────────────────────── */

export const SITE_SECTION_IDS = [
  'historia', 'cerimonia', 'hospedagem', 'mensagem', 'galeria', 'presentes', 'mural', 'faq', 'rsvp', 'contagem',
] as const
export type SiteSectionId = (typeof SITE_SECTION_IDS)[number]

export const SITE_SECTION_LABELS: Record<SiteSectionId, string> = {
  historia:   'Nossa história',
  cerimonia:  'Cerimônia e festa',
  hospedagem: 'Hospedagem e como chegar',
  mensagem:   'Mensagem aos convidados',
  galeria:    'Galeria',
  presentes:  'Lista de presentes',
  mural:      'Mural de fotos dos convidados',
  faq:        'Perguntas frequentes',
  rsvp:       'Confirmação de presença',
  contagem:   'Contagem regressiva',
}

export interface SiteSectionsConfig {
  order?:  SiteSectionId[]
  hidden?: SiteSectionId[]
}

// Ordem original de cada estilo — a mesma do JSX antes da personalização, com
// as seções novas (só aparecem quando preenchidas) em posições neutras.
const PREMIUM_ORDER: SiteSectionId[] = ['historia', 'cerimonia', 'hospedagem', 'mensagem', 'galeria', 'presentes', 'mural', 'faq', 'rsvp']

export const DEFAULT_SECTION_ORDER: Record<SiteTemplate, SiteSectionId[]> = {
  classic:      ['historia', 'cerimonia', 'hospedagem', 'mensagem', 'presentes', 'galeria', 'mural', 'faq', 'rsvp'],
  portfolio:    ['mensagem', 'historia', 'cerimonia', 'hospedagem', 'presentes', 'galeria', 'mural', 'faq', 'rsvp'],
  editorial:    PREMIUM_ORDER,
  garden:       PREMIUM_ORDER,
  invitation:   PREMIUM_ORDER,
  enveloped:    PREMIUM_ORDER,
  photographic: ['galeria', 'historia', 'cerimonia', 'hospedagem', 'mensagem', 'presentes', 'mural', 'faq', 'rsvp'],
}

/** Itens que só podem ser ocultados (ficam numa posição fixa do layout, ex.: contagem na capa). */
export const HIDE_ONLY_SECTIONS: Partial<Record<SiteTemplate, SiteSectionId[]>> = {
  portfolio: ['contagem'],
}

function isSectionId(value: unknown): value is SiteSectionId {
  return SITE_SECTION_IDS.some((id) => id === value)
}

/**
 * Ordem efetiva das seções do estilo. Uma ordem salva vale entre estilos: ids
 * que o estilo não tem são ignorados e os que faltam entram logo depois do
 * vizinho da ordem original (seção nova nunca vai parar no fim por acidente).
 */
export function resolveSectionOrder(template: SiteTemplate, order: SiteSectionId[] | undefined): SiteSectionId[] {
  const defaults = DEFAULT_SECTION_ORDER[template]
  if (!order || order.length === 0) return [...defaults]

  const result: SiteSectionId[] = []
  for (const id of order) if (defaults.includes(id) && !result.includes(id)) result.push(id)
  defaults.forEach((id, index) => {
    if (result.includes(id)) return
    const previous = defaults.slice(0, index).reverse().find((candidate) => result.includes(candidate))
    result.splice(previous ? result.indexOf(previous) + 1 : 0, 0, id)
  })
  return result
}

/** RSVP e presentes continuam usando as chaves antigas (hide_rsvp/hide_gifts). */
export function isSectionHidden(
  content: { sections?: SiteSectionsConfig; hide_rsvp?: boolean; hide_gifts?: boolean },
  id: SiteSectionId,
): boolean {
  if (id === 'rsvp') return content.hide_rsvp === true
  if (id === 'presentes') return content.hide_gifts === true
  return content.sections?.hidden?.includes(id) ?? false
}

/* ───────────────────────── Perguntas frequentes e hospedagem ───────────────────────── */

export const FAQ_LIMITS = { items: 8, question: 160, answer: 1000 } as const
export const LODGING_LIMITS = { items: 3, name: 120, address: 240, mapUrl: 500, phone: 40, notes: 600, discountCode: 60 } as const

export interface SiteFaqItem {
  question: string
  answer:   string
}

export interface SiteLodgingItem {
  name:           string
  address?:       string
  map_url?:       string
  phone?:         string
  notes?:         string
  discount_code?: string
}

const LODGING_TEXT_KEYS = ['address', 'map_url', 'phone', 'notes', 'discount_code'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Link de mapa: só http(s), nunca javascript:/data: etc. */
export function isSafeMapUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
}

/** Telefone só com caracteres de telefone — vira link tel: no site. */
export function isPhoneText(value: string): boolean {
  return /^[0-9+()\-.\s]{6,40}$/.test(value) && /\d{6,}/.test(value.replace(/\D/g, ''))
}

export function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return `tel:${digits}`
}

/** Link de busca no Google Maps a partir do endereço — usado quando o casal não informa um link. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/* ───────────────────────── Monograma em imagem ───────────────────────── */

const WEDDING_PHOTOS_URL_MARKER = '/storage/v1/object/public/wedding-photos/'

/** URL pública de um arquivo do próprio casamento no bucket de fotos (nunca externa). */
export function isWeddingPhotoUrl(url: string, weddingId: string): boolean {
  if (!isSafeMapUrl(url)) return false
  const index = url.indexOf(WEDDING_PHOTOS_URL_MARKER)
  if (index === -1) return false
  const path = url.slice(index + WEDDING_PHOTOS_URL_MARKER.length)
  return path.startsWith(`${weddingId}/`) && !path.slice(weddingId.length + 1).includes('/') && !path.includes('..')
}

export function storagePathFromPhotoUrl(url: string): string | null {
  const index = url.indexOf(WEDDING_PHOTOS_URL_MARKER)
  return index === -1 ? null : decodeURIComponent(url.slice(index + WEDDING_PHOTOS_URL_MARKER.length))
}

export const MONOGRAM_IMAGE_LIMITS = { maxFileBytes: 2 * 1024 * 1024, maxDimension: 600 } as const

/* ───────────────────────── Leitura tolerante (JSON salvo → tipos) ───────────────────────── */

export interface SiteCustomization {
  font_pair?:          SiteFontPairId
  palette?:            SitePalette
  sections?:           SiteSectionsConfig
  faq?:                SiteFaqItem[]
  lodging?:            SiteLodgingItem[]
  monogram_image_url?: string
}

function trimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/** Descarta o que estiver malformado em vez de quebrar o site. */
export function parseCustomization(raw: Record<string, unknown>): SiteCustomization {
  const result: SiteCustomization = {}

  if (isSiteFontPair(raw.font_pair)) result.font_pair = raw.font_pair

  const rawPalette = raw.palette
  if (isRecord(rawPalette)) {
    const palette: SitePalette = {}
    if (isHexColor(rawPalette.accent)) palette.accent = rawPalette.accent.toUpperCase()
    if (SITE_TONES.some((tone) => tone === rawPalette.tone)) palette.tone = rawPalette.tone as SiteTone
    if (SEAL_FINISHES.some((seal) => seal === rawPalette.seal)) palette.seal = rawPalette.seal as SealFinish
    if (Object.keys(palette).length > 0) result.palette = palette
  }

  if (isRecord(raw.sections)) {
    const sections: SiteSectionsConfig = {}
    const order = Array.isArray(raw.sections.order) ? raw.sections.order.filter(isSectionId) : []
    const hidden = Array.isArray(raw.sections.hidden) ? raw.sections.hidden.filter(isSectionId) : []
    if (order.length > 0) sections.order = [...new Set(order)]
    if (hidden.length > 0) sections.hidden = [...new Set(hidden)]
    if (sections.order || sections.hidden) result.sections = sections
  }

  if (Array.isArray(raw.faq)) {
    const faq = raw.faq
      .filter(isRecord)
      .map((item) => ({ question: trimmedString(item.question, FAQ_LIMITS.question), answer: trimmedString(item.answer, FAQ_LIMITS.answer) }))
      .filter((item): item is SiteFaqItem => Boolean(item.question && item.answer))
      .slice(0, FAQ_LIMITS.items)
    if (faq.length > 0) result.faq = faq
  }

  if (Array.isArray(raw.lodging)) {
    const lodging: SiteLodgingItem[] = []
    for (const item of raw.lodging.filter(isRecord).slice(0, LODGING_LIMITS.items)) {
      const name = trimmedString(item.name, LODGING_LIMITS.name)
      if (!name) continue
      const entry: SiteLodgingItem = { name }
      const address = trimmedString(item.address, LODGING_LIMITS.address)
      const mapUrl = trimmedString(item.map_url, LODGING_LIMITS.mapUrl)
      const phone = trimmedString(item.phone, LODGING_LIMITS.phone)
      const notes = trimmedString(item.notes, LODGING_LIMITS.notes)
      const discountCode = trimmedString(item.discount_code, LODGING_LIMITS.discountCode)
      if (address) entry.address = address
      if (mapUrl && isSafeMapUrl(mapUrl)) entry.map_url = mapUrl
      if (phone && isPhoneText(phone)) entry.phone = phone
      if (notes) entry.notes = notes
      if (discountCode) entry.discount_code = discountCode
      lodging.push(entry)
    }
    if (lodging.length > 0) result.lodging = lodging
  }

  if (typeof raw.monogram_image_url === 'string' && URL.canParse(raw.monogram_image_url)) {
    result.monogram_image_url = raw.monogram_image_url
  }

  return result
}

/* ───────────────────────── Validação estrita (API) ───────────────────────── */

/** Mensagem de erro para o casal, ou null se as chaves de personalização estiverem válidas. */
export function validateCustomization(content: Record<string, unknown>): string | null {
  if (content.font_pair !== undefined && !isSiteFontPair(content.font_pair)) return 'Escolha uma combinação de fontes válida.'

  if (content.palette !== undefined) {
    const palette = content.palette
    if (!isRecord(palette)) return 'Configuração de cores inválida.'
    if (palette.accent !== undefined && !isHexColor(palette.accent)) return 'Escolha uma cor de destaque válida.'
    if (palette.tone !== undefined && !SITE_TONES.some((tone) => tone === palette.tone)) return 'Escolha um fundo válido.'
    if (palette.seal !== undefined && !SEAL_FINISHES.some((seal) => seal === palette.seal)) return 'Escolha um acabamento de selo válido.'
    if (isHexColor(palette.accent)) {
      const issue = accentContrastIssue(palette.accent, (palette.tone as SiteTone | undefined) ?? 'cream')
      if (issue) return issue
    }
  }

  if (content.sections !== undefined) {
    const sections = content.sections
    if (!isRecord(sections)) return 'Configuração das seções inválida.'
    for (const key of ['order', 'hidden'] as const) {
      const list = sections[key]
      if (list !== undefined && (!Array.isArray(list) || list.length > SITE_SECTION_IDS.length || !list.every(isSectionId))) {
        return 'Configuração das seções inválida.'
      }
    }
  }

  if (content.faq !== undefined) {
    if (!Array.isArray(content.faq)) return 'Perguntas frequentes inválidas.'
    if (content.faq.length > FAQ_LIMITS.items) return `Cadastre no máximo ${FAQ_LIMITS.items} perguntas frequentes.`
    for (const item of content.faq) {
      if (!isRecord(item) || typeof item.question !== 'string' || typeof item.answer !== 'string') return 'Perguntas frequentes inválidas.'
      if (!item.question.trim() || !item.answer.trim()) return 'Preencha a pergunta e a resposta de cada item.'
      if (item.question.length > FAQ_LIMITS.question) return `Cada pergunta pode ter até ${FAQ_LIMITS.question} caracteres.`
      if (item.answer.length > FAQ_LIMITS.answer) return `Cada resposta pode ter até ${FAQ_LIMITS.answer} caracteres.`
    }
  }

  if (content.lodging !== undefined) {
    if (!Array.isArray(content.lodging)) return 'Locais de hospedagem inválidos.'
    if (content.lodging.length > LODGING_LIMITS.items) return `Cadastre no máximo ${LODGING_LIMITS.items} locais de hospedagem.`
    for (const item of content.lodging) {
      if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim()) return 'Informe o nome de cada local de hospedagem.'
      if (item.name.length > LODGING_LIMITS.name) return `O nome do local pode ter até ${LODGING_LIMITS.name} caracteres.`
      for (const key of LODGING_TEXT_KEYS) {
        if (item[key] !== undefined && typeof item[key] !== 'string') return 'Locais de hospedagem inválidos.'
      }
      const lengths: [unknown, number, string][] = [
        [item.address, LODGING_LIMITS.address, 'O endereço'], [item.notes, LODGING_LIMITS.notes, 'A observação'],
        [item.discount_code, LODGING_LIMITS.discountCode, 'O código de desconto'], [item.map_url, LODGING_LIMITS.mapUrl, 'O link do mapa'],
      ]
      for (const [value, max, label] of lengths) {
        if (typeof value === 'string' && value.length > max) return `${label} pode ter até ${max} caracteres.`
      }
      if (typeof item.map_url === 'string' && item.map_url.trim() && !isSafeMapUrl(item.map_url.trim())) return 'Informe um link de mapa começando com https://.'
      if (typeof item.phone === 'string' && item.phone.trim() && !isPhoneText(item.phone.trim())) return 'Informe um telefone válido para o local de hospedagem.'
    }
  }

  if (content.monogram_image_url !== undefined && (typeof content.monogram_image_url !== 'string' || !URL.canParse(content.monogram_image_url))) {
    return 'Envie a imagem do monograma novamente.'
  }

  return null
}

/* ───────────────────────── Contraste ───────────────────────── */

function channelLuminance(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const int = parseInt(hex.replace('#', ''), 16)
  return 0.2126 * channelLuminance((int >> 16) & 255) + 0.7152 * channelLuminance((int >> 8) & 255) + 0.0722 * channelLuminance(int & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Mistura duas cores hex (peso de `a` entre 0 e 1). */
export function mixHex(a: string, b: string, weight: number): string {
  const parse = (hex: string) => { const int = parseInt(hex.replace('#', ''), 16); return [(int >> 16) & 255, (int >> 8) & 255, int & 255] }
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const channel = (x = 0, y = 0) => Math.round(x * weight + y * (1 - weight)).toString(16).padStart(2, '0')
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`.toUpperCase()
}

/**
 * Textos de destaque usam a cor de destaque escurecida (fundos claros) ou
 * clareada (fundo escuro). Exige contraste AA (4,5:1) contra o fundo do tom.
 */
export function accentTextOnTone(scale: { light: string; dark: string }, tone: SiteTone): string {
  return tone === 'dark' ? scale.light : scale.dark
}

export function accentContrastIssue(accent: string, tone: SiteTone): string | null {
  const text = accentTextOnTone(deriveWeddingColorScale(accent), tone)
  return contrastRatio(text, SITE_TONE_COLORS[tone].bg) < 4.5
    ? 'Essa cor de destaque fica difícil de ler com o fundo escolhido. Escolha um tom mais forte (ou mais claro, no fundo escuro).'
    : null
}

/* ───────────────────────── Planos ───────────────────────── */

export interface SiteFeatureAccess {
  monogram:  boolean
  fontPairs: boolean
  tone:      boolean
  seal:      boolean
  lodging:   boolean
}

/** Gratuito: cor de destaque, ordem/visibilidade das seções e perguntas frequentes. */
export function siteFeatureAccess(planId: PlanId): SiteFeatureAccess {
  const paid = isPaidPlan(planId)
  return { monogram: paid, fontPairs: paid, tone: paid, seal: paid, lodging: paid }
}

interface GatedContent {
  envelope_monogram?:  string
  monogram_image_url?: string
  font_pair?:          SiteFontPairId
  palette?:            SitePalette
  lodging?:            SiteLodgingItem[]
}

/** Remove do conteúdo público o que o plano atual não libera (a configuração salva é preservada). */
export function stripLockedCustomization<T extends GatedContent>(content: T, planId: PlanId): T {
  const access = siteFeatureAccess(planId)
  const next = { ...content }
  if (!access.monogram) { delete next.envelope_monogram; delete next.monogram_image_url }
  if (!access.fontPairs) delete next.font_pair
  if (!access.lodging) delete next.lodging
  if (next.palette && (!access.tone || !access.seal)) {
    const palette = { ...next.palette }
    if (!access.tone) delete palette.tone
    if (!access.seal) delete palette.seal
    if (Object.keys(palette).length > 0) next.palette = palette
    else delete next.palette
  }
  return next
}

function changedAndFilled(next: unknown, previous: unknown): boolean {
  const filled = next !== undefined && next !== null && next !== '' && !(Array.isArray(next) && next.length === 0)
  return filled && JSON.stringify(next) !== JSON.stringify(previous)
}

/**
 * Recurso bloqueado pelo plano que o casal tenta ATIVAR ou MUDAR. Manter um
 * valor salvo antes de um downgrade não é erro (o site só deixa de exibir).
 */
export function lockedCustomizationChange(
  next: Record<string, unknown>,
  previous: Record<string, unknown>,
  planId: PlanId,
): string | null {
  const access = siteFeatureAccess(planId)
  const nextPalette = isRecord(next.palette) ? next.palette : {}
  const previousPalette = isRecord(previous.palette) ? previous.palette : {}
  if (!access.monogram && (changedAndFilled(next.envelope_monogram, previous.envelope_monogram) || changedAndFilled(next.monogram_image_url, previous.monogram_image_url))) {
    return 'O monograma está disponível a partir do plano Ideal.'
  }
  if (!access.fontPairs && changedAndFilled(next.font_pair, previous.font_pair)) return 'As combinações de fontes estão disponíveis a partir do plano Ideal.'
  if (!access.tone && changedAndFilled(nextPalette.tone, previousPalette.tone)) return 'A escolha de fundo está disponível a partir do plano Ideal.'
  if (!access.seal && changedAndFilled(nextPalette.seal, previousPalette.seal)) return 'O acabamento do selo está disponível a partir do plano Ideal.'
  if (!access.lodging && changedAndFilled(next.lodging, previous.lodging)) return 'A seção de hospedagem está disponível a partir do plano Ideal.'
  return null
}

/** Seções do estilo na ordem efetiva, sem as que o casal ocultou. */
export function visibleSectionOrder(
  template: SiteTemplate,
  content: { sections?: SiteSectionsConfig; hide_rsvp?: boolean; hide_gifts?: boolean },
): SiteSectionId[] {
  return resolveSectionOrder(template, content.sections?.order).filter((id) => !isSectionHidden(content, id))
}
