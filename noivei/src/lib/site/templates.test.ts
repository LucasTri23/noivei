import { describe, expect, it } from 'vitest'
import { PLAN_IDS } from '@/constants/plans'
import { allowsSiteMonogram, canUseSiteTemplate, resolveSiteTemplate } from './templates'
import { SITE_TEMPLATE_CONFIG } from './template-config'

describe('estilos de site por plano', () => {
  const free = ['classic', 'photographic']
  const ideal = [...free, 'portfolio', 'editorial', 'garden']
  const exclusive = [...ideal, 'invitation', 'enveloped']

  it.each([
    [PLAN_IDS.FREE, free],
    [PLAN_IDS.PREMIUM_MONTHLY, ideal],
    [PLAN_IDS.PREMIUM_ONCE, ideal],
    [PLAN_IDS.PLUS_MONTHLY, exclusive],
    [PLAN_IDS.PLUS_ONCE, exclusive],
  ] as const)('aplica a matriz de estilos e monograma para %s', (plan, allowed) => {
    for (const template of Object.keys(SITE_TEMPLATE_CONFIG)) {
      expect(canUseSiteTemplate(plan, template)).toBe(allowed.includes(template))
      expect(resolveSiteTemplate(template, plan)).toBe(allowed.includes(template) ? template : 'classic')
    }
    expect(allowsSiteMonogram(plan)).toBe(plan !== PLAN_IDS.FREE)
    expect(resolveSiteTemplate('invalid', plan)).toBe('classic')
  })
})
