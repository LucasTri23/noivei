import { describe, expect, it } from 'vitest'

import {
  buildVendorMarketplaceHref,
  hasActiveVendorFilters,
  parseVendorMarketplaceFilters,
} from './marketplace-filters'

describe('parseVendorMarketplaceFilters', () => {
  it('deve descartar campos vazios ou só espaço', () => {
    expect(parseVendorMarketplaceFilters({ busca: '  ', cidade: undefined })).toEqual({
      busca: undefined, categoria: undefined, cidade: undefined, estado: undefined, preco: undefined,
    })
  })

  it('deve aceitar o primeiro valor quando o param vem como array', () => {
    expect(parseVendorMarketplaceFilters({ cidade: ['Curitiba', 'São Paulo'] }).cidade).toBe('Curitiba')
  })

  it('deve descartar um preco fora do enum válido', () => {
    expect(parseVendorMarketplaceFilters({ preco: '$$$$' }).preco).toBeUndefined()
  })

  it('deve aceitar um preco válido', () => {
    expect(parseVendorMarketplaceFilters({ preco: '$$' }).preco).toBe('$$')
  })
})

describe('hasActiveVendorFilters', () => {
  it('deve retornar false quando nenhum filtro está ativo', () => {
    expect(hasActiveVendorFilters({})).toBe(false)
  })

  it('deve retornar true quando ao menos um filtro está ativo', () => {
    expect(hasActiveVendorFilters({ categoria: 'buffet' })).toBe(true)
  })
})

describe('buildVendorMarketplaceHref', () => {
  it('deve devolver a URL base sem parâmetros quando não há filtro nenhum', () => {
    expect(buildVendorMarketplaceHref({})).toBe('/fornecedores')
  })

  it('deve preservar os filtros existentes ao trocar a categoria', () => {
    const href = buildVendorMarketplaceHref({ cidade: 'Curitiba', busca: 'flor' }, { categoria: 'buffet' })
    expect(href).toBe('/fornecedores?busca=flor&categoria=buffet&cidade=Curitiba')
  })

  it('deve remover um filtro quando o override manda undefined', () => {
    const href = buildVendorMarketplaceHref({ categoria: 'buffet' }, { categoria: undefined })
    expect(href).toBe('/fornecedores')
  })
})
