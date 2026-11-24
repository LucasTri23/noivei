import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import type { SiteContent } from '@/lib/site/site-content'

import PremiumSite from './premium-site'

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false }))))
afterEach(() => vi.unstubAllGlobals())

const CONTENT: SiteContent = {
  our_story: 'Nos conhecemos em 2018.',
  ceremony_info: 'Às 16h, na igreja.',
  custom_message: 'Contamos com vocês!',
  faq: [{ question: 'Tem estacionamento?', answer: 'Sim.' }],
}

function site(variant: 'enveloped' | 'invitation', content: SiteContent = CONTENT): PublicSiteInfo {
  return {
    wedding: { couple_names: 'Ana & João', wedding_date: '2027-05-20', venue: 'Igreja', city: 'Curitiba', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' },
    content, galleryPhotos: [], story: { layout: 'legacy' },
    cover_photo_url: null, cover_photo_position: 50, cover_photo_zoom: 0,
    template: variant, albumEnabled: false, gifts: [],
  }
}

const panels = () => screen.getAllByRole('group', { hidden: true }).filter((el) => el.getAttribute('aria-roledescription') === 'dobra do convite')
const states = () => panels().map((panel) => panel.getAttribute('data-state'))

function openEnvelope() {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir convite de casamento' }))
}

describe('Envelopado — convite que se desdobra de lado', () => {
  it('deve montar uma dobra para a capa e uma para cada seção, na ordem do estilo', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    // Seções sem conteúdo (galeria, presentes, hospedagem, mural) não viram dobra.
    expect(panels().map((panel) => panel.getAttribute('aria-label'))).toEqual([
      '1 de 6: Convite', '2 de 6: Nossa história', '3 de 6: Cerimônia e festa',
      '4 de 6: Mensagem aos convidados', '5 de 6: Perguntas frequentes', '6 de 6: Confirmação de presença',
    ])
    expect(states()[0]).toBe('active')
    expect(states().slice(1).every((state) => state === 'folded')).toBe(true)
  })

  it('deve seguir a ordem e a visibilidade escolhidas pelo casal', () => {
    render(<PremiumSite slug="casal" site={site('enveloped', { ...CONTENT, sections: { order: ['faq', 'historia'], hidden: ['mensagem'] } })} variant="enveloped" />)
    const labels = panels().map((panel) => panel.getAttribute('aria-label')?.replace(/^\d+ de \d+: /, ''))
    // RSVP não foi posicionado pelo casal: entra logo depois do vizinho original (perguntas).
    expect(labels).toEqual(['Convite', 'Perguntas frequentes', 'Confirmação de presença', 'Nossa história', 'Cerimônia e festa'])
  })

  it('deve desdobrar o próximo painel pela seta e voltar pelo painel anterior', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    openEnvelope()
    fireEvent.click(screen.getByRole('button', { name: 'Desdobrar o próximo painel' }))
    expect(states().slice(0, 3)).toEqual(['before', 'active', 'folded'])
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para Convite' }))
    expect(states()[0]).toBe('active')
    expect(screen.getByRole('button', { name: 'Dobra anterior' })).toHaveProperty('disabled', true)
  })

  it('deve aceitar as setas do teclado só depois de abrir o envelope', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(states()[0]).toBe('active')
    openEnvelope()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(states().indexOf('active')).toBe(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(states().indexOf('active')).toBe(1)
  })

  it('deve levar o link "Conheça o nosso grande dia" até a dobra da cerimônia', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    openEnvelope()
    fireEvent.click(screen.getByText(/Conheça o nosso grande dia/))
    const active = panels().find((panel) => panel.getAttribute('data-state') === 'active')
    expect(active?.getAttribute('aria-label')).toMatch(/Cerimônia e festa/)
  })

  it('deve deixar fora do teclado e do leitor de tela as dobras fechadas', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    const [first, second] = panels()
    expect(first?.hasAttribute('aria-hidden')).toBe(false)
    expect(second?.getAttribute('aria-hidden')).toBe('true')
    expect(second?.querySelector('[inert]')).not.toBeNull()
  })

  it('deve desdobrar com gesto horizontal e ignorar rolagem vertical', () => {
    render(<PremiumSite slug="casal" site={site('enveloped')} variant="enveloped" />)
    openEnvelope()
    const root = panels()[0]!.closest('[class]')!.parentElement!.parentElement!
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 300 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 290, clientY: 100 }] })
    expect(states()[0]).toBe('active')
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 300 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 150, clientY: 310 }] })
    expect(states()[1]).toBe('active')
  })

  it('não deve mudar o Convite Selado (continua uma página rolando para baixo)', () => {
    render(<PremiumSite slug="casal" site={site('invitation')} variant="invitation" />)
    expect(panels()).toHaveLength(0)
    expect(screen.queryByRole('navigation', { name: 'Navegar pelo convite', hidden: true })).toBeNull()
  })
})
