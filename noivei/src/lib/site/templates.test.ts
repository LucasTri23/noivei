import { describe, expect, it } from 'vitest'
import { isPlusPlan, type PlanId } from '@/constants/plans'
import { EXCLUSIVE_SITE_TEMPLATES, resolveSiteTemplate } from './templates'

describe('estilos exclusivos', () => {
  it.each(['free', 'premium_monthly', 'premium_once'])('não libera os três novos estilos para %s', (plan) => {
    for (const template of EXCLUSIVE_SITE_TEMPLATES) expect(resolveSiteTemplate(template, true, isPlusPlan(plan as PlanId))).toBe('classic')
  })
  it.each(['premium_plus_monthly', 'premium_plus_once'])('libera os três novos estilos para %s', (plan) => {
    for (const template of EXCLUSIVE_SITE_TEMPLATES) expect(resolveSiteTemplate(template, false, isPlusPlan(plan as PlanId))).toBe(template)
  })
  it('preserva a regra do Portfólio e usa fallback para valores desconhecidos', () => {
    expect(resolveSiteTemplate('portfolio', true, false)).toBe('portfolio')
    expect(resolveSiteTemplate('portfolio', false, true)).toBe('classic')
    expect(resolveSiteTemplate('invalid', true, true)).toBe('classic')
  })
})
