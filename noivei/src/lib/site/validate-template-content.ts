import type { SiteTemplate } from '@/types/database'
import { validateCustomization } from './customization'
import { isStoryLayout } from './story/story-layouts'
import { SITE_TEMPLATE_CONFIG } from './template-config'

/** Campos ocultos e fotos excedentes antigos ficam preservados ao trocar de estilo. */
export function validateTemplateContent(template: SiteTemplate, content: Record<string, unknown> | undefined, existing: Record<string, unknown> = {}): string | null {
  if (!content) return null
  const monogram = content.envelope_monogram
  if (monogram !== undefined && monogram !== existing.envelope_monogram && (typeof monogram !== 'string' || monogram.length > 12)) return 'Revise o monograma do casal.'
  const config = SITE_TEMPLATE_CONFIG[template]
  const styleFields = new Map(Object.values(SITE_TEMPLATE_CONFIG).flatMap((item) => item.fields).map((field) => [field.key, field]))
  for (const [key, field] of styleFields) {
    const value = content[key]
    if (value === undefined || value === existing[key]) continue
    if (typeof value !== 'string' || value.length > field.maxLength) return 'Revise o campo ' + field.label + '.'
    if (value && !config.fields.some((allowed) => allowed.key === key)) return 'Este campo não está disponível no estilo ' + config.label + '.'
  }
  // Modo incompatível com o estilo não é erro: fica salvo e o site usa o padrão
  // do estilo na renderização (resolveStoryLayout), preservando a escolha.
  if (content.story_layout !== undefined && !isStoryLayout(content.story_layout)) return 'Escolha uma apresentação válida para a história.'
  if (content.rich_text !== undefined && typeof content.rich_text !== 'boolean') return 'Configuração de formatação inválida.'
  for (const key of ['hide_rsvp', 'hide_gifts'] as const) {
    if (content[key] !== undefined && typeof content[key] !== 'boolean') return 'Configuração de visibilidade das seções inválida.'
  }
  const customizationError = validateCustomization(content)
  if (customizationError) return customizationError
  const photos = content.gallery_urls
  if (photos === undefined) return null
  if (!Array.isArray(photos) || photos.some((url) => typeof url !== 'string' || !URL.canParse(url) || !/^https?:/.test(url))) return 'Informe URLs válidas para as fotos da galeria.'
  if (config.galleryLimit !== null && photos.length > config.galleryLimit && JSON.stringify(photos) !== JSON.stringify(existing.gallery_urls)) return 'O estilo ' + config.label + ' permite até ' + config.galleryLimit + ' fotos na galeria.'
  return null
}
