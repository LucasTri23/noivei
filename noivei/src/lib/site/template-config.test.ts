import { describe, expect, it } from 'vitest'
import { SITE_TEMPLATE_CONFIG, limitTemplateGallery } from './template-config'
import { validateTemplateContent } from './validate-template-content'
import { parseSiteContent } from './site-content'
describe('conteúdo específico dos estilos', () => {
  it.each([['portfolio', 14], ['editorial', 8], ['garden', 12], ['invitation', 6]] as const)('limita a galeria pública do estilo %s sem apagar originais', (template, count) => {
    const photos = Array.from({ length: 20 }, (_, n) => 'https://example.com/' + n + '.jpg')
    expect(limitTemplateGallery(photos, template)).toHaveLength(count)
    expect(photos).toHaveLength(20)
    expect(validateTemplateContent(template, { gallery_urls: photos })).toContain('até ' + count)
    expect(validateTemplateContent(template, { gallery_urls: photos }, { gallery_urls: photos })).toBeNull()
  })
  it('clássico usa galeria em polaroids e não oferece foto de história sem efeito', () => {
    expect(SITE_TEMPLATE_CONFIG.classic.storyPhoto).toBe(false)
    expect(limitTemplateGallery(Array(30).fill('foto'), 'classic')).toHaveLength(30)
  })
  it('campos exclusivos do envelope não são aceitos em outros estilos', () => {
    expect(validateTemplateContent('classic', { opening_hint: 'Abra' })).toContain('não está disponível')
    expect(validateTemplateContent('invitation', { opening_hint: 'Abra' })).toBeNull()
    expect(validateTemplateContent('invitation', { opening_hint: 'x'.repeat(101) })).toContain('Revise')
    expect(validateTemplateContent('invitation', { opening_hint: 123 })).toContain('Revise')
  })
  it('preserva textos ocultos ao trocar de estilo e normaliza os novos textos públicos', () => {
    expect(validateTemplateContent('classic', { opening_hint: 'Abra' }, { opening_hint: 'Abra' })).toBeNull()
    expect(parseSiteContent({ hero_subtitle: 'Olá', opening_hint: 'Abra', story_heading: 'Nós', gallery_heading: 'Fotos', envelope_caption: 'Para você' })).toEqual({ hero_subtitle: 'Olá', opening_hint: 'Abra', story_heading: 'Nós', gallery_heading: 'Fotos', envelope_caption: 'Para você' })
  })
  it('não aceita valores malformados nem URLs de script na galeria', () => {
    expect(validateTemplateContent('invitation', { gallery_urls: ['javascript:alert(1)'] })).toContain('URLs válidas')
    expect(validateTemplateContent('invitation', { gallery_urls: [123] })).toContain('URLs válidas')
  })
})
