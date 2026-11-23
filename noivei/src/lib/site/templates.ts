import { isPaidPlan, isPlusPlan, type PlanId } from '@/constants/plans'
import type { SiteTemplate } from '@/types/database'

export const EXCLUSIVE_SITE_TEMPLATES = ['invitation', 'enveloped'] as const
const PREMIUM_SITE_TEMPLATES = ['editorial', 'garden', 'photographic', ...EXCLUSIVE_SITE_TEMPLATES] as const
export type PremiumSiteTemplate = (typeof PREMIUM_SITE_TEMPLATES)[number]

export function isPremiumSiteTemplate(value: unknown): value is PremiumSiteTemplate {
  return PREMIUM_SITE_TEMPLATES.some((template) => template === value)
}

export const allowsSiteMonogram = isPaidPlan

export function canUseSiteTemplate(planId: PlanId, value: unknown): value is SiteTemplate {
  switch (value) {
    case 'classic':
    case 'photographic':
      return true
    case 'portfolio':
    case 'editorial':
    case 'garden':
      return isPaidPlan(planId)
    case 'invitation':
    case 'enveloped':
      return isPlusPlan(planId)
    default:
      return false
  }
}

export function resolveSiteTemplate(value: unknown, planId: PlanId): SiteTemplate {
  return canUseSiteTemplate(planId, value) ? value : 'classic'
}
