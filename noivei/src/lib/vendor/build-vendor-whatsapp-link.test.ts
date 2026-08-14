import { describe, expect, it } from 'vitest'

import { buildVendorWhatsAppUrl } from './build-vendor-whatsapp-link'

describe('buildVendorWhatsAppUrl', () => {
  it('deve remover tudo que não for dígito do telefone', () => {
    const url = buildVendorWhatsAppUrl({ businessName: 'Buffet Flor', whatsapp: '+55 (11) 91234-5678' })
    expect(url).toContain('https://wa.me/5511912345678?text=')
  })

  it('deve incluir o nome do fornecedor na mensagem pré-preenchida', () => {
    const url = buildVendorWhatsAppUrl({ businessName: 'Buffet Flor', whatsapp: '11912345678' })
    const message = decodeURIComponent(url.split('?text=')[1] ?? '')
    expect(message).toContain('Buffet Flor')
  })
})
