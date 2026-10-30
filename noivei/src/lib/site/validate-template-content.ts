import type { SiteTemplate } from '@/types/database'
import { SITE_TEMPLATE_CONFIG } from './template-config'

/** Campos ocultos e fotos excedentes antigos ficam preservados ao trocar de estilo. */
export function validateTemplateContent(template: SiteTemplate, content: Record<string, unknown> | undefined, existing: Record<string, unknown> = {}): string | null {
  if (!content) return null
  const config = SITE_TEMPLATE_CONFIG[template]
  const styleFields = new Map(Object.values(SITE_TEMPLATE_CONFIG).flatMap((item) => item.fields).map((field) => [field.key, field]))
  for (const [key, field] of styleFields) {
    const value = content[key]
    if (value === undefined || value === existing[key]) continue
    if (typeof value !== 'string' || value.length > field.maxLength) return 'Revise o campo ' + field.label + '.'
    if (value && !config.fields.some((allowed) => allowed.key === key)) return 'Este campo não está disponível no estilo ' + config.label + '.'
  }
  const photos = content.gallery_urls
  if (photos === undefined) return null
  if (!Array.isArray(photos) || photos.some((url) => typeof url !== 'string' || !URL.canParse(url) || !/^https?:/.test(url))) return 'Informe URLs válidas para as fotos da galeria.'
  if (config.galleryLimit !== null && photos.length > config.galleryLimit && JSON.stringify(photos) !== JSON.stringify(existing.gallery_urls)) return 'O estilo ' + config.label + ' permite até ' + config.galleryLimit + ' fotos na galeria.'
  return null
}
