import { describe, expect, it } from 'vitest'

import {
  accentContrastIssue, contrastRatio, DEFAULT_SECTION_ORDER, isSectionHidden, isWeddingPhotoUrl, lockedCustomizationChange,
  parseCustomization, resolveSectionOrder, SITE_TONE_COLORS, SITE_TONES, stripLockedCustomization, validateCustomization,
  visibleSectionOrder,
} from './customization'

const WID = '11111111-1111-4111-8111-111111111111'
const photoUrl = (path: string) => `https://proj.supabase.co/storage/v1/object/public/wedding-photos/${path}`

describe('parseCustomization', () => {
  it('deve descartar valores malformados em vez de quebrar o site', () => {
    expect(parseCustomization({ font_pair: 'comic-sans', palette: { accent: 'red', tone: 'neon', seal: 'ouro' }, sections: { order: ['xyz'] } })).toEqual({})
  })

  it('deve descartar link de mapa perigoso e telefone com outros caracteres, mantendo o local', () => {
    const { lodging } = parseCustomization({ lodging: [{ name: 'Hotel', map_url: 'javascript:alert(1)', phone: '<b>41</b>' }] })
    expect(lodging).toEqual([{ name: 'Hotel' }])
  })

  it('deve limitar perguntas a 8 e locais a 3 mesmo se o JSON salvo tiver mais', () => {
    const faq = Array.from({ length: 12 }, (_, n) => ({ question: `P${n}`, answer: 'R' }))
    const lodging = Array.from({ length: 5 }, (_, n) => ({ name: `L${n}` }))
    const parsed = parseCustomization({ faq, lodging })
    expect(parsed.faq).toHaveLength(8)
    expect(parsed.lodging).toHaveLength(3)
  })
})

describe('validateCustomization', () => {
  it('deve recusar mais de 8 perguntas e mais de 3 locais', () => {
    expect(validateCustomization({ faq: Array.from({ length: 9 }, () => ({ question: 'a', answer: 'b' })) })).toMatch(/8/)
    expect(validateCustomization({ lodging: Array.from({ length: 4 }, () => ({ name: 'a' })) })).toMatch(/3/)
  })

  it('deve recusar pergunta sem resposta e link de mapa que não seja http(s)', () => {
    expect(validateCustomization({ faq: [{ question: 'Tem estacionamento?', answer: ' ' }] })).not.toBeNull()
    expect(validateCustomization({ lodging: [{ name: 'Hotel', map_url: 'javascript:alert(1)' }] })).toMatch(/https/)
    expect(validateCustomization({ lodging: [{ name: 'Hotel', map_url: 'data:text/html,x' }] })).toMatch(/https/)
  })

  it('deve aceitar um conteúdo completo e válido', () => {
    expect(validateCustomization({
      font_pair: 'elegante',
      palette: { accent: '#7A2E3B', tone: 'cream', seal: 'wax' },
      sections: { order: ['faq', 'historia'], hidden: ['mural'] },
      faq: [{ question: 'Posso levar acompanhante?', answer: 'Só os nomes do convite.' }],
      lodging: [{ name: 'Pousada', address: 'Rua A, 1', map_url: 'https://maps.app.goo.gl/x', phone: '(41) 99999-0000', discount_code: 'ANAJOAO' }],
    })).toBeNull()
  })

  it('deve recusar cor de destaque ilegível sobre o fundo escolhido', () => {
    expect(validateCustomization({ palette: { accent: '#FFF8E1', tone: 'light' } })).toMatch(/difícil de ler/)
    expect(accentContrastIssue('#14110E', 'dark')).not.toBeNull()
    expect(accentContrastIssue('#7A2E3B', 'cream')).toBeNull()
  })
})

describe('cores dos fundos', () => {
  it.each(SITE_TONES)('deve ter texto e texto secundário legíveis (AA) no fundo %s', (tone) => {
    const colors = SITE_TONE_COLORS[tone]
    expect(contrastRatio(colors.fg, colors.bg)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(colors.mutedFg, colors.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.fg, colors.surface)).toBeGreaterThanOrEqual(7)
  })
})

describe('resolveSectionOrder', () => {
  it('deve manter a ordem original do estilo sem configuração', () => {
    expect(resolveSectionOrder('photographic', undefined)).toEqual(DEFAULT_SECTION_ORDER.photographic)
  })

  it('deve encaixar seções ausentes logo depois do vizinho original e ignorar as que o estilo não tem', () => {
    expect(resolveSectionOrder('classic', ['rsvp', 'historia', 'contagem'])).toEqual(
      ['rsvp', 'historia', 'cerimonia', 'hospedagem', 'mensagem', 'presentes', 'galeria', 'mural', 'faq'],
    )
  })

  it('deve valer entre estilos: a mesma ordem salva serve para o Portfólio', () => {
    const order = resolveSectionOrder('portfolio', ['faq', 'mensagem'])
    expect(order[0]).toBe('faq')
    expect(new Set(order)).toEqual(new Set(DEFAULT_SECTION_ORDER.portfolio))
  })
})

describe('visibilidade', () => {
  it('deve respeitar hide_rsvp e hide_gifts antigos e a lista nova de ocultas', () => {
    const content = { hide_rsvp: true, hide_gifts: true, sections: { hidden: ['galeria' as const] } }
    expect(isSectionHidden(content, 'rsvp')).toBe(true)
    expect(isSectionHidden(content, 'presentes')).toBe(true)
    expect(visibleSectionOrder('editorial', content)).not.toContain('galeria')
    expect(visibleSectionOrder('editorial', content)).toContain('historia')
  })
})

describe('monograma em imagem', () => {
  it('deve aceitar só arquivo do próprio casamento, na raiz da pasta dele', () => {
    expect(isWeddingPhotoUrl(photoUrl(`${WID}/monograma.webp`), WID)).toBe(true)
    expect(isWeddingPhotoUrl(photoUrl(`22222222-2222-4222-8222-222222222222/monograma.webp`), WID)).toBe(false)
    expect(isWeddingPhotoUrl(photoUrl(`${WID}/sub/monograma.webp`), WID)).toBe(false)
    expect(isWeddingPhotoUrl('https://evil.test/monograma.png', WID)).toBe(false)
    expect(isWeddingPhotoUrl(`javascript:alert(1)//${photoUrl(`${WID}/a.png`)}`, WID)).toBe(false)
  })
})

describe('planos', () => {
  const premiumContent = {
    envelope_monogram: 'A & J', monogram_image_url: photoUrl(`${WID}/m.webp`), font_pair: 'elegante' as const,
    palette: { accent: '#7A2E3B', tone: 'dark' as const, seal: 'wax' as const }, lodging: [{ name: 'Hotel' }],
    faq: [{ question: 'P', answer: 'R' }],
  }

  it('deve esconder no site público o que o plano Gratuito não libera, mantendo cor de destaque e perguntas', () => {
    const stripped = stripLockedCustomization(premiumContent, 'free')
    expect(stripped).toEqual({ palette: { accent: '#7A2E3B' }, faq: premiumContent.faq })
    expect(stripLockedCustomization(premiumContent, 'premium_monthly')).toEqual(premiumContent)
  })

  it('deve bloquear ativar recurso pago no Gratuito, mas não manter o valor salvo antes de um downgrade', () => {
    expect(lockedCustomizationChange({ font_pair: 'elegante' }, {}, 'free')).toMatch(/fontes/)
    expect(lockedCustomizationChange({ palette: { tone: 'dark' } }, {}, 'free')).toMatch(/fundo/)
    expect(lockedCustomizationChange({ lodging: [{ name: 'Hotel' }] }, {}, 'free')).toMatch(/hospedagem/)
    expect(lockedCustomizationChange({ monogram_image_url: 'x' }, {}, 'free')).toMatch(/monograma/)
    expect(lockedCustomizationChange(premiumContent, premiumContent, 'free')).toBeNull()
    expect(lockedCustomizationChange({ palette: { accent: '#7A2E3B' }, faq: [{ question: 'P', answer: 'R' }] }, {}, 'free')).toBeNull()
    expect(lockedCustomizationChange(premiumContent, {}, 'premium_once')).toBeNull()
  })
})
