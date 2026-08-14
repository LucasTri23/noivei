import { describe, expect, it } from 'vitest'
import { slugifyBusinessName } from '@/lib/vendor/slug'

describe('slugifyBusinessName', () => {
  it('deve gerar slug em minúsculas separado por hífen a partir do nome da empresa', () => {
    expect(slugifyBusinessName('Studio Amor Fotografia')).toBe('studio-amor-fotografia')
  })

  it('deve remover acentos e caracteres especiais', () => {
    expect(slugifyBusinessName('Buffet & Cia — Confeitaria Ltda.')).toBe('buffet-cia-confeitaria-ltda')
  })

  it('deve colapsar espaços/hífens repetidos em um único hífen', () => {
    expect(slugifyBusinessName('  Doces   da    Vovó  ')).toBe('doces-da-vovo')
  })

  it('deve truncar nomes muito longos em 80 caracteres', () => {
    const longName = 'A'.repeat(200)
    expect(slugifyBusinessName(longName).length).toBeLessThanOrEqual(80)
  })

  it('deve retornar um fallback quando o nome não sobra nenhum caractere válido', () => {
    expect(slugifyBusinessName('!!!')).toBe('fornecedor')
  })
})
