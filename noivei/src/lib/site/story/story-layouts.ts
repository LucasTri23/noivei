import type { SiteTemplate } from '@/types/database'

export const STORY_LAYOUTS = ['illustrated', 'timeline', 'gallery'] as const
export type StoryLayout = (typeof STORY_LAYOUTS)[number]

/** 'legacy' = apresentação original do estilo, antes dos momentos/fotos da história. */
export type EffectiveStoryLayout = StoryLayout | 'legacy'

export const STORY_LAYOUT_LABELS: Record<StoryLayout, { label: string; description: string }> = {
  illustrated: { label: 'História ilustrada', description: 'O texto com as fotos distribuídas ao longo da narrativa.' },
  timeline:    { label: 'Linha do tempo',     description: 'Os momentos em ordem cronológica, com datas, fotos e descrições.' },
  gallery:     { label: 'Galeria narrativa',  description: 'Várias fotos com legendas acompanhando a história.' },
}

interface TemplateStoryLayouts {
  supported: readonly StoryLayout[]
  default:   StoryLayout
}

// Convite Selado não tem linha do tempo: a composição do convite é uma
// mensagem contínua, e uma linha do tempo longa competiria com o envelope.
export const STORY_LAYOUTS_BY_TEMPLATE: Record<SiteTemplate, TemplateStoryLayouts> = {
  classic:    { supported: ['illustrated', 'timeline', 'gallery'], default: 'timeline' },
  portfolio:  { supported: ['illustrated', 'timeline', 'gallery'], default: 'gallery' },
  editorial:  { supported: ['illustrated', 'timeline', 'gallery'], default: 'illustrated' },
  garden:     { supported: ['illustrated', 'timeline', 'gallery'], default: 'illustrated' },
  invitation: { supported: ['illustrated', 'gallery'],             default: 'illustrated' },
}

export function isStoryLayout(value: unknown): value is StoryLayout {
  return STORY_LAYOUTS.some((layout) => layout === value)
}

/**
 * Modo efetivo para renderizar. Sem escolha salva → 'legacy' (apresentação
 * atual do estilo, intocada). Escolha salva incompatível com o estilo atual →
 * padrão do estilo, só na renderização: o valor salvo não muda, então voltar
 * ao estilo anterior restaura a escolha do casal.
 */
export function resolveStoryLayout(template: SiteTemplate, stored: unknown): EffectiveStoryLayout {
  if (!isStoryLayout(stored)) return 'legacy'
  const config = STORY_LAYOUTS_BY_TEMPLATE[template]
  return config.supported.includes(stored) ? stored : config.default
}
