import { describe, expect, it } from 'vitest'

import { finalizeSiteSlug, normalizeSiteSlugInput, siteSlugAlternatives, suggestSiteSlug } from './slug'

describe('endereço do site', () => {
  it('normaliza enquanto o casal digita, mantendo o hífen final', () => {
    expect(normalizeSiteSlugInput('Ana E João ')).toBe('ana-e-joao-')
    expect(normalizeSiteSlugInput('--Maria__&__Zé!!')).toBe('maria-ze-')
  })

  it('remove hífens das pontas na versão final', () => {
    expect(finalizeSiteSlug('ana-e-joao-')).toBe('ana-e-joao')
  })

  it('sugere o endereço a partir do nome do casal', () => {
    expect(suggestSiteSlug('Ana & João')).toBe('ana-e-joao')
    expect(suggestSiteSlug('Lú + Bê')).toBe('lu-e-be')
    expect(suggestSiteSlug('&')).toBe('nosso-casamento')
  })

  it('não sugere um endereço reservado por rotas do app', () => {
    expect(suggestSiteSlug('Site')).toBe('site-casamento')
  })

  it('gera alternativas numeradas', () => {
    expect(siteSlugAlternatives('ana-e-joao', 2)).toEqual(['ana-e-joao-2', 'ana-e-joao-3'])
  })
})
