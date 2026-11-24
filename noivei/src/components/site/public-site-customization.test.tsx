import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'


import { DEFAULT_SECTION_ORDER, parseCustomization, type SiteSectionId } from '@/lib/site/customization'
import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import type { SiteContent } from '@/lib/site/site-content'
import type { SiteTemplate } from '@/types/database'

import PublicSiteView from './public-site-view'

const WID = '11111111-1111-4111-8111-111111111111'
const MONOGRAM_URL = `https://proj.supabase.co/storage/v1/object/public/wedding-photos/${WID}/monograma.webp`
const TEMPLATES: SiteTemplate[] = ['classic', 'portfolio', 'editorial', 'garden', 'invitation', 'enveloped', 'photographic']

const FILLED: SiteContent = {
  our_story: 'Nos conhecemos em 2018.',
  ceremony_info: 'Às 16h.',
  custom_message: 'Contamos com vocês!',
  ...parseCustomization({
    faq: [{ question: 'Tem estacionamento?', answer: 'Sim, gratuito.' }],
    lodging: [{ name: 'Pousada do Lago', address: 'Rua das Flores, 10', phone: '(41) 99999-0000', discount_code: 'ANAJOAO', map_url: 'javascript:alert(1)' }],
  }),
}

function makeSite(template: SiteTemplate, content: SiteContent): PublicSiteInfo {
  return {
    wedding: { couple_names: 'Ana & João', wedding_date: '2027-05-20', venue: 'Igreja', city: 'Curitiba', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' },
    content,
    galleryPhotos: [1, 2, 3].map((n) => ({ url: `https://cdn.test/g-${n}.jpg`, position_y: 50, fit_contain: false })),
    story: { layout: 'legacy' },
    cover_photo_url: null, cover_photo_position: 50, cover_photo_zoom: 0,
    template, albumEnabled: false, gifts: [],
  }
}

function renderSite(template: SiteTemplate, content: SiteContent) {
  return render(<PublicSiteView slug="casal" site={makeSite(template, content)} />)
}

// Posição de cada seção identificável no DOM (as que têm id) — para conferir a ordem.
const SECTION_DOM_ID: Partial<Record<SiteSectionId, string>> = { historia: 'historia', hospedagem: 'hospedagem', faq: 'duvidas', rsvp: 'rsvp' }

function domOrder(container: HTMLElement): string[] {
  const ids = Object.values(SECTION_DOM_ID)
  return [...container.querySelectorAll('section[id]')].map((el) => el.id).filter((id) => ids.includes(id))
}

describe('personalização do site público', () => {
  describe.each(TEMPLATES)('%s', (template) => {
    it('deve manter a ordem original quando o casal não configurou seções', () => {
      const { container } = renderSite(template, FILLED)
      const expected = DEFAULT_SECTION_ORDER[template].map((id) => SECTION_DOM_ID[id]).filter(Boolean)
      expect(domOrder(container)).toEqual(expected)
    })

    it('deve seguir a ordem escolhida e esconder as seções ocultas', () => {
      const { container } = renderSite(template, { ...FILLED, sections: { order: ['rsvp', 'faq', 'historia'], hidden: ['hospedagem'] } })
      expect(domOrder(container)).toEqual(['rsvp', 'duvidas', 'historia'])
      expect(container.querySelector('#hospedagem')).toBeNull()
    })

    it('deve exibir perguntas frequentes como acordeão nativo e hospedagem sem link perigoso', () => {
      const { container } = renderSite(template, FILLED)
      const summary = screen.getByText('Tem estacionamento?')
      expect(summary.closest('details')).not.toBeNull()
      fireEvent.click(summary)
      expect(screen.getByText('Pousada do Lago')).toBeTruthy()
      expect(container.innerHTML).not.toContain('javascript:')
      // Sem link válido, o mapa vem do endereço.
      expect(container.querySelector('a[href^="https://www.google.com/maps/search/"][href*="Rua%20das%20Flores"]')).not.toBeNull()
      expect(container.querySelector('a[href="tel:41999990000"]')).not.toBeNull()
    })

    it('deve mostrar a imagem do monograma onde o estilo exibe monograma, com o texto como descrição', () => {
      const { container } = renderSite(template, { envelope_monogram: 'A & J', monogram_image_url: MONOGRAM_URL })
      const images = [...container.querySelectorAll(`img[src="${MONOGRAM_URL}"]`)]
      expect(images.length).toBeGreaterThan(0)
      expect(images.every((img) => img.getAttribute('alt') === 'Monograma A & J')).toBe(true)
    })

    it('deve aplicar fonte, cor de destaque e fundo escuro só quando configurados', () => {
      const plain = renderSite(template, {})
      const plainRoot = plain.container.firstElementChild as HTMLElement
      expect(plainRoot.getAttribute('data-site-tone')).toBeNull()
      expect(plainRoot.style.getPropertyValue('--font-display')).toBe('')
      expect(plainRoot.style.getPropertyValue('--wedding-color')).toBe('#777C5A')
      plain.unmount()

      const { container } = renderSite(template, { font_pair: 'elegante', palette: { accent: '#7A2E3B', tone: 'dark' } })
      const root = container.firstElementChild as HTMLElement
      expect(root.getAttribute('data-site-tone')).toBe('dark')
      expect(root.style.getPropertyValue('--wedding-color')).toBe('#7A2E3B')
      expect(root.style.getPropertyValue('--bg')).toBe('#17130F')
      expect(root.style.getPropertyValue('--font-display')).toBe('var(--site-font-playfair)')
      expect(root.className).toContain('font--site-font-playfair')
    })
  })

  describe('Convite Selado e Envelopado', () => {
    it.each(['invitation', 'enveloped'] as const)('deve manter o selo e aplicar o acabamento escolhido (%s)', (template) => {
      renderSite(template, { palette: { seal: 'wax' } })
      const seal = screen.getByRole('button', { name: 'Abrir convite de casamento' })
      expect(seal.getAttribute('data-finish')).toBe('wax')
      expect(document.getElementById('invitation-content')?.hidden).toBe(true)
    })

    it('deve manter o selo dourado original sem atributo extra', () => {
      renderSite('invitation', {})
      expect(screen.getByRole('button', { name: 'Abrir convite de casamento' }).hasAttribute('data-finish')).toBe(false)
    })

    it('não deve escurecer o envelope ao usar fundo escuro (cores do envelope intactas)', () => {
      const { container } = renderSite('invitation', { palette: { tone: 'dark' } })
      const root = container.firstElementChild as HTMLElement
      expect(root.style.getPropertyValue('--wedding-color-dark')).not.toBe(root.style.getPropertyValue('--wedding-color-light'))
    })
  })

  it('Portfólio: deve permitir ocultar a contagem regressiva', () => {
    const shown = renderSite('portfolio', { ...FILLED })
    const countdownText = () => shown.container.textContent ?? ''
    const before = countdownText()
    shown.unmount()
    const hidden = renderSite('portfolio', { ...FILLED, sections: { hidden: ['contagem'] } })
    expect((hidden.container.textContent ?? '').length).toBeLessThan(before.length)
  })

  it('Clássico: história oculta devolve as fotos da história para a galeria', () => {
    const { container } = renderSite('classic', { our_story: 'Texto', sections: { hidden: ['historia'] } })
    expect(container.querySelectorAll('img[src^="https://cdn.test/g-"]')).toHaveLength(3)
  })
})
