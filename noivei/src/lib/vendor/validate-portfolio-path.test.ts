import { describe, expect, it } from 'vitest'
import { validatePortfolioObjectName } from './validate-portfolio-path'

describe('validatePortfolioObjectName', () => {
  it('deve aceitar um nome sanitizado com extensão batendo o MIME real', () => {
    const result = validatePortfolioObjectName('a1b2c3d4-foto-do-casamento.jpg', 'image/jpeg')
    expect(result.valid).toBe(true)
  })

  it('deve rejeitar caracteres fora do charset seguro (path traversal / espaços / acentos)', () => {
    expect(validatePortfolioObjectName('../../etc/passwd', 'image/jpeg').valid).toBe(false)
    expect(validatePortfolioObjectName('foto com espaço.jpg', 'image/jpeg').valid).toBe(false)
    expect(validatePortfolioObjectName('café.jpg', 'image/jpeg').valid).toBe(false)
  })

  it('deve rejeitar extensão fora da allowlist', () => {
    const result = validatePortfolioObjectName('script.svg', 'image/svg+xml')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('invalid_extension')
  })

  it('deve rejeitar quando a extensão não bate com o MIME real reportado pelo Storage (spoofing)', () => {
    // Extensão .jpg mas o Storage reportou o arquivo como PNG de verdade — sinal de
    // tentativa de disfarçar o tipo real do arquivo.
    const result = validatePortfolioObjectName('foto.jpg', 'image/png')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('extension_mime_mismatch')
  })

  it('deve aceitar todas as extensões permitidas com o MIME correspondente', () => {
    expect(validatePortfolioObjectName('a.png', 'image/png').valid).toBe(true)
    expect(validatePortfolioObjectName('a.jpeg', 'image/jpeg').valid).toBe(true)
    expect(validatePortfolioObjectName('a.webp', 'image/webp').valid).toBe(true)
    expect(validatePortfolioObjectName('a.heic', 'image/heic').valid).toBe(true)
  })
})
