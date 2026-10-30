import type { SiteTemplate } from '@/types/database'

export const EXCLUSIVE_SITE_TEMPLATES = ['editorial', 'garden', 'invitation'] as const
export type ExclusiveSiteTemplate = (typeof EXCLUSIVE_SITE_TEMPLATES)[number]
export function isExclusiveSiteTemplate(value: unknown): value is ExclusiveSiteTemplate {
  return EXCLUSIVE_SITE_TEMPLATES.some((template) => template === value)
}

/** Não confia no valor salvo: downgrade ou template desconhecido usa Clássico. */
export function resolveSiteTemplate(value: unknown, albumEnabled: boolean, exclusiveEnabled: boolean): SiteTemplate {
  if (isExclusiveSiteTemplate(value)) return exclusiveEnabled ? value : 'classic'
  if (value === 'portfolio' && albumEnabled) return 'portfolio'
  return 'classic'
}
