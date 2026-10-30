import type { SiteTemplate } from '@/types/database'
import { SITE_TEMPLATE_CONFIG } from './template-config'
/** Limites de exibição por estilo; armazenamento continua sujeito ao plano. */
export const GALLERY_PHOTO_LIMIT_BY_TEMPLATE = Object.fromEntries(
  Object.entries(SITE_TEMPLATE_CONFIG).map(([key, config]) => [key, config.galleryLimit]),
) as Record<SiteTemplate, number | null>
