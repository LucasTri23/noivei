import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import type { SiteContent } from '@/lib/site/site-content'
import { buildStoryView, type StoryData } from '@/lib/site/story/story-model'
import type { StoryLayout } from '@/lib/site/story/story-layouts'
import type { SiteTemplate } from '@/types/database'

import ClassicSite from './classic-site'
import PortfolioSite from './portfolio-site'
import PremiumSite from './premium-site'

const STORY_DATA: StoryData = {
  moments: [
    { id: 'm1', title: 'O primeiro encontro', description: 'Foi num **café**.', happened_on: '2018-03-02', date_precision: 'month', sort_order: 0 },
    { id: 'm2', title: 'O pedido', description: null, happened_on: '2022-12-24', date_precision: 'day', sort_order: 1 },
  ],
  photos: [
    { id: 'p1', url: 'https://cdn.test/w1/story-1.jpg', caption: 'Praia', moment_id: null, sort_order: 0, width: 1200, height: 900, position_y: 50, fit_contain: false },
    { id: 'p2', url: 'https://cdn.test/w1/story-2.jpg', caption: null, moment_id: 'm1', sort_order: 1, width: null, height: null, position_y: 50, fit_contain: false },
  ],
}

const GALLERY = [1, 2, 3].map((n) => ({ url: `https://cdn.test/w1/gallery-${n}.jpg`, position_y: 50, fit_contain: false }))

function makeSite(template: SiteTemplate, content: SiteContent, layout?: StoryLayout): PublicSiteInfo {
  const fullContent = { ...content, ...(layout ? { story_layout: layout } : {}) }
  return {
    wedding: { couple_names: 'Ana & João', wedding_date: '2027-05-20', venue: null, city: 'Curitiba', wedding_color: '#777c5a', wedding_color_secondary: '#a47859' },
    content: fullContent,
    galleryPhotos: GALLERY,
    story: buildStoryView(template, fullContent.story_layout, fullContent.our_story, STORY_DATA),
    cover_photo_url: null, cover_photo_position: 50, cover_photo_zoom: 0,
    template, albumEnabled: false, gifts: [],
  }
}

function renderSite(template: SiteTemplate, content: SiteContent, layout?: StoryLayout) {
  const site = makeSite(template, content, layout)
  if (template === 'classic') return render(<ClassicSite slug="casal" site={site} />)
  if (template === 'portfolio') return render(<PortfolioSite slug="casal" site={site} />)
  return render(<PremiumSite slug="casal" site={site} variant={template} />)
}

const TEMPLATES: SiteTemplate[] = ['classic', 'portfolio', 'editorial', 'garden', 'invitation']
const storyImages = (container: HTMLElement) => [...container.querySelectorAll('img')].filter((img) => img.src.includes('/story-'))

describe('Nossa História por estilo', () => {
  describe.each(TEMPLATES)('%s', (template) => {
    it('deve manter a apresentação original sem escolha de modo (sem fotos da história, texto literal)', () => {
      const { container } = renderSite(template, { our_story: 'Nos conhecemos **em 2018**.' })
      expect(storyImages(container)).toHaveLength(0)
      expect(container.textContent).toContain('Nos conhecemos **em 2018**.')
      expect([...container.querySelectorAll('strong')].some((el) => el.textContent?.includes('2018'))).toBe(false)
    })

    it('deve exibir fotos, legendas e momentos quando o casal escolhe a apresentação padrão do estilo', () => {
      const { container } = renderSite(template, { our_story: 'Era uma vez.' }, template === 'portfolio' ? 'gallery' : template === 'classic' ? 'timeline' : 'illustrated')
      const images = storyImages(container)
      expect(images.length).toBeGreaterThanOrEqual(2)
      expect(images.every((img) => img.getAttribute('loading') === 'lazy')).toBe(true)
      expect(container.textContent).toContain('O primeiro encontro')
      expect(container.textContent).toContain('Praia')
      expect(container.querySelectorAll('#historia')).toHaveLength(1)
    })

    it('deve renderizar Markdown só com rich_text ativado', () => {
      const { container } = renderSite(template, { our_story: 'Um dia **inesquecível**.', rich_text: true }, 'illustrated')
      expect([...container.querySelectorAll('strong')].map((el) => el.textContent)).toContain('inesquecível')
    })

    it('deve exibir a seção mesmo sem texto principal quando há momentos e fotos', () => {
      const { container } = renderSite(template, {}, 'illustrated')
      expect(container.querySelector('#historia')).not.toBeNull()
    })
  })

  it('não deve exibir linha do tempo no Convite Selado: usa o padrão do estilo sem perder a escolha', () => {
    const site = makeSite('invitation', { our_story: 'x' }, 'timeline')
    expect(site.story.layout).toBe('illustrated')
    expect(site.content.story_layout).toBe('timeline')
  })

  it('deve preservar o envelope e o selo do Convite Selado com a história nova', () => {
    renderSite('invitation', { our_story: 'Com carinho.' }, 'illustrated')
    expect(screen.getByRole('button', { name: 'Abrir convite de casamento' })).toBeTruthy()
    const content = document.getElementById('invitation-content')
    expect(content?.hidden).toBe(true)
    expect(content?.querySelector('#historia')).not.toBeNull()
  })

  it('no Clássico, deve devolver à galeria as fotos que a apresentação original usava como polaroids', () => {
    const legacy = renderSite('classic', { our_story: 'texto' })
    // Apresentação original: as 3 fotos da galeria viram polaroids da história (desktop + mobile).
    expect([...legacy.container.querySelectorAll('img')].filter((img) => img.src.includes('/gallery-')).length).toBeGreaterThan(0)
    legacy.unmount()

    const fresh = renderSite('classic', { our_story: 'texto' }, 'timeline')
    expect(storyImages(fresh.container).length).toBeGreaterThan(0)
    expect([...fresh.container.querySelectorAll('img')].filter((img) => img.src.includes('/gallery-'))).toHaveLength(GALLERY.length)
  })
})
