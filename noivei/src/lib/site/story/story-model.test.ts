import { describe, expect, it } from 'vitest'

import { resolveStoryLayout, STORY_LAYOUTS_BY_TEMPLATE } from './story-layouts'
import {
  buildStoryView,
  formatStoryDate,
  interleaveStory,
  sortMomentsChronologically,
  splitStoryParagraphs,
  type StoryMomentInput,
  type StoryPhotoInput,
  type StoryPhotoView,
} from './story-model'

const moment = (id: string, overrides: Partial<StoryMomentInput> = {}): StoryMomentInput => ({
  id, title: `Momento ${id}`, description: null, happened_on: null, date_precision: 'day', sort_order: 0, ...overrides,
})

const photo = (id: string, overrides: Partial<StoryPhotoInput> = {}): StoryPhotoInput => ({
  id, url: `https://cdn.test/${id}.jpg`, caption: null, moment_id: null, sort_order: 0,
  width: null, height: null, position_y: 50, fit_contain: false, ...overrides,
})

const view = (p: StoryPhotoInput): StoryPhotoView => ({ ...p, displayCaption: p.caption })

describe('resolveStoryLayout', () => {
  it('deve manter a apresentação original quando o casal não escolheu um modo', () => {
    expect(resolveStoryLayout('classic', undefined)).toBe('legacy')
    expect(resolveStoryLayout('invitation', 'qualquer')).toBe('legacy')
  })

  it('deve respeitar o modo escolhido quando o estilo suporta', () => {
    expect(resolveStoryLayout('portfolio', 'timeline')).toBe('timeline')
  })

  it('deve usar o padrão do estilo, sem perder a escolha, quando o modo não é suportado', () => {
    expect(resolveStoryLayout('invitation', 'timeline')).toBe(STORY_LAYOUTS_BY_TEMPLATE.invitation.default)
    // voltando para um estilo compatível, a escolha original reaparece
    expect(resolveStoryLayout('classic', 'timeline')).toBe('timeline')
  })

  it('deve ter padrão suportado em todos os estilos', () => {
    for (const config of Object.values(STORY_LAYOUTS_BY_TEMPLATE)) {
      expect(config.supported).toContain(config.default)
    }
  })
})

describe('formatStoryDate', () => {
  it('deve formatar conforme a precisão sem deslocar o dia por fuso', () => {
    expect(formatStoryDate('2019-06-01', 'day')).toBe('1 de junho de 2019')
    expect(formatStoryDate('2019-06-01', 'month')).toBe('junho de 2019')
    expect(formatStoryDate('2019-06-01', 'year')).toBe('2019')
  })

  it('deve devolver null para data ausente ou malformada', () => {
    expect(formatStoryDate(null, 'day')).toBeNull()
    expect(formatStoryDate('2019-13-01', 'day')).toBeNull()
    expect(formatStoryDate('ontem', 'day')).toBeNull()
  })
})

describe('splitStoryParagraphs', () => {
  it('deve separar por linha em branco e manter quebras simples no parágrafo', () => {
    expect(splitStoryParagraphs('a\nb\n\n  \nc\n \n\n')).toEqual(['a\nb', 'c'])
  })
})

describe('interleaveStory', () => {
  const photos = ['1', '2', '3', '4'].map((id) => view(photo(id)))

  it('deve começar pelo texto e distribuir os grupos de fotos entre os parágrafos', () => {
    const blocks = interleaveStory(['p1', 'p2', 'p3', 'p4'], photos)
    expect(blocks.map((b) => (b.type === 'text' ? b.text : b.photos.map((p) => p.id).join('+')))).toEqual(
      ['p1', '1+2', 'p2', 'p3', '3+4', 'p4'],
    )
    expect(blocks.filter((b) => b.type === 'photos').map((b) => (b.type === 'photos' ? b.offset : -1))).toEqual([0, 2])
  })

  it('deve agrupar várias fotos no mesmo ponto quando há mais grupos que parágrafos', () => {
    const blocks = interleaveStory(['único'], photos)
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({ type: 'text', text: 'único' })
  })

  it('deve devolver um único bloco de fotos quando não há texto', () => {
    expect(interleaveStory([], photos)).toEqual([{ type: 'photos', photos, offset: 0 }])
  })

  it('deve devolver só texto quando não há fotos', () => {
    expect(interleaveStory(['a', 'b'], [])).toEqual([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])
  })
})

describe('sortMomentsChronologically', () => {
  it('deve ordenar datados por data e manter os sem data no fim, na ordem do casal', () => {
    const ordered = sortMomentsChronologically([
      moment('sem-data-2', { sort_order: 3 }),
      moment('2020', { happened_on: '2020-01-01', sort_order: 0 }),
      moment('sem-data-1', { sort_order: 1 }),
      moment('2018', { happened_on: '2018-05-10', sort_order: 2 }),
    ])
    expect(ordered.map((m) => m.id)).toEqual(['2018', '2020', 'sem-data-1', 'sem-data-2'])
  })
})

describe('buildStoryView', () => {
  const data = {
    moments: [
      moment('pedido', { happened_on: '2022-12-24', sort_order: 0 }),
      moment('encontro', { happened_on: '2018-03-02', date_precision: 'month', sort_order: 1 }),
    ],
    photos: [
      photo('b', { sort_order: 1, moment_id: 'pedido' }),
      photo('a', { sort_order: 0, caption: '  Praia  ' }),
      photo('c', { sort_order: 2, moment_id: 'apagado' }),
    ],
  }

  it('deve devolver legacy sem escolha de modo, mesmo com fotos e momentos cadastrados', () => {
    expect(buildStoryView('classic', undefined, 'texto', data)).toEqual({ layout: 'legacy' })
  })

  it('deve ordenar a linha do tempo cronologicamente e rotular as datas', () => {
    const result = buildStoryView('classic', 'timeline', '', data)
    if (result.layout === 'legacy') throw new Error('esperado modo novo')
    expect(result.moments.map((m) => m.id)).toEqual(['encontro', 'pedido'])
    expect(result.moments[0]?.dateLabel).toBe('março de 2018')
    expect(result.moments[1]?.photos.map((p) => p.id)).toEqual(['b'])
  })

  it('deve manter a ordem do casal nos momentos fora da linha do tempo', () => {
    const result = buildStoryView('editorial', 'illustrated', 'x', data)
    if (result.layout === 'legacy') throw new Error('esperado modo novo')
    expect(result.moments.map((m) => m.id)).toEqual(['pedido', 'encontro'])
  })

  it('deve tratar foto de momento inexistente como foto solta e usar a legenda ou o título do momento', () => {
    const result = buildStoryView('portfolio', 'gallery', 'Era uma vez', data)
    if (result.layout === 'legacy') throw new Error('esperado modo novo')
    expect(result.allPhotos.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(result.loosePhotos.map((p) => p.id)).toEqual(['a', 'c'])
    expect(result.allPhotos.map((p) => p.displayCaption)).toEqual(['Praia', 'Momento pedido', null])
  })

  it('deve indicar ausência de conteúdo quando não há texto, fotos nem momentos', () => {
    const result = buildStoryView('garden', 'illustrated', '   ', { moments: [], photos: [] })
    expect(result.layout !== 'legacy' && result.hasContent).toBe(false)
  })
})
