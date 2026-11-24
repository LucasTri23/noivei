import { describe, expect, it } from 'vitest'

import { buildSitePatch, dirtySections, referencedPhotoUrls, type SiteDraft } from './site-draft'

const base: SiteDraft = {
  slug: 'ana-e-joao', published: false, template: 'classic',
  coverPhotoUrl: null, coverPhotoPosition: 50, coverPhotoZoom: 0,
  content: { our_story: 'Nos conhecemos na faculdade.' },
}

describe('rascunho do site', () => {
  it('não considera alteração quando só há espaços sobrando', () => {
    const draft = { ...base, content: { our_story: '  Nos conhecemos na faculdade.  ' } }
    expect(dirtySections(draft, base).size).toBe(0)
    expect(buildSitePatch(draft, base, 'free')).toEqual({ ok: true, body: null })
  })

  it('aponta a aba de cada alteração', () => {
    const draft = { ...base, published: true, content: { ...base.content, ceremony_info: 'Igreja Matriz', hide_rsvp: true } }
    expect([...dirtySections(draft, base)].sort()).toEqual(['capa', 'cerimonia', 'rsvp'])
  })

  it('envia só os campos alterados, com o conteúdo normalizado', () => {
    const draft = { ...base, published: true, content: { ...base.content, dress_code: '  Esporte fino ', custom_message: '' } }
    expect(buildSitePatch(draft, base, 'free')).toEqual({
      ok: true,
      body: { published: true, content: { our_story: 'Nos conhecemos na faculdade.', dress_code: 'Esporte fino' } },
    })
  })

  it('valida o endereço e aponta a aba Capa', () => {
    const result = buildSitePatch({ ...base, slug: 'login' }, base, 'free')
    expect(result).toMatchObject({ ok: false, section: 'capa' })
  })

  it('bloqueia galeria acima do limite do estilo e aponta a aba Galeria', () => {
    const gallery_urls = Array.from({ length: 9 }, (_, n) => `https://example.com/${n}.jpg`)
    const result = buildSitePatch({ ...base, template: 'editorial', content: { ...base.content, gallery_urls } }, base, 'premium_monthly')
    expect(result).toMatchObject({ ok: false, section: 'galeria' })
  })

  it('descarta campos de estilo que o estilo escolhido não usa', () => {
    const draft = { ...base, content: { ...base.content, hero_subtitle: 'Bem-vindos' } }
    expect(buildSitePatch(draft, base, 'premium_monthly')).toEqual({ ok: true, body: null })
  })

  it('lista as fotos usadas pelo rascunho', () => {
    const draft = { ...base, coverPhotoUrl: 'https://a/capa.jpg', content: { story_photo_url: 'https://a/h.jpg', gallery_urls: ['https://a/1.jpg'] } }
    expect([...referencedPhotoUrls(draft)].sort()).toEqual(['https://a/1.jpg', 'https://a/capa.jpg', 'https://a/h.jpg'])
  })
})

describe('rascunho com personalização', () => {
  const monogramUrl = 'https://proj.supabase.co/storage/v1/object/public/wedding-photos/w1/monograma.webp'

  it('deve proteger a imagem do monograma da limpeza de fotos não usadas', () => {
    expect(referencedPhotoUrls({ ...base, content: { monogram_image_url: monogramUrl } }).has(monogramUrl)).toBe(true)
  })

  it('deve descartar perguntas totalmente vazias e apontar a aba quando falta a resposta', () => {
    const empty = buildSitePatch({ ...base, content: { ...base.content, faq: [{ question: ' ', answer: '' }] } }, base, 'free')
    expect(empty).toEqual({ ok: true, body: null })
    const partial = buildSitePatch({ ...base, content: { ...base.content, faq: [{ question: 'Tem estacionamento?', answer: '' }] } }, base, 'free')
    expect(partial).toMatchObject({ ok: false, section: 'informacoes' })
  })

  it('não deve enviar recursos pagos no Gratuito e deve enviar os livres', () => {
    const draft = { ...base, content: { ...base.content, font_pair: 'elegante' as const, palette: { accent: '#7A2E3B', tone: 'dark' as const }, sections: { hidden: ['mural' as const] } } }
    const result = buildSitePatch(draft, base, 'free')
    expect(result).toEqual({ ok: true, body: { content: { ...base.content, palette: { accent: '#7A2E3B' }, sections: { hidden: ['mural'] } } } })
  })

  it('deve marcar as abas novas como alteradas', () => {
    const draft = { ...base, content: { ...base.content, font_pair: 'elegante' as const, sections: { order: ['faq' as const] }, lodging: [{ name: 'Hotel' }] } }
    expect([...dirtySections(draft, base)].sort()).toEqual(['aparencia', 'informacoes', 'secoes'])
  })
})
