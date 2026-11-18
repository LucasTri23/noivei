import { describe, expect, it } from 'vitest'

import { parseSiteContent } from './site-content'
import { resolveStoryLayout } from './story/story-layouts'
import { validateTemplateContent } from './validate-template-content'

// Troca de estilo: o builder (saveCapa) reenvia { template, content } com o
// content inteiro relido por parseSiteContent — por isso story_layout e
// rich_text precisam sobreviver ao parse e passar na validação do novo estilo.
describe('troca de estilo e a seção Nossa História', () => {
  const saved = { our_story: 'Era uma vez', story_layout: 'timeline', rich_text: true }

  it('deve aceitar reenviar um modo que o novo estilo não suporta, sem exigir mudança', () => {
    expect(validateTemplateContent('invitation', saved, saved)).toBeNull()
  })

  it('deve manter story_layout e rich_text ao reler o conteúdo salvo', () => {
    const content = parseSiteContent(saved)
    expect(content.story_layout).toBe('timeline')
    expect(content.rich_text).toBe(true)
  })

  it('deve exibir o padrão do Convite e recuperar a escolha ao voltar para o Clássico', () => {
    const content = parseSiteContent(saved)
    expect(resolveStoryLayout('invitation', content.story_layout)).toBe('illustrated')
    expect(resolveStoryLayout('classic', content.story_layout)).toBe('timeline')
  })

  it('deve continuar no modo legado em qualquer estilo quando o casal nunca escolheu um modo', () => {
    const content = parseSiteContent({ our_story: 'Era uma vez' })
    expect(content.story_layout).toBeUndefined()
    expect(content.rich_text).toBeUndefined()
    for (const template of ['classic', 'portfolio', 'editorial', 'garden', 'invitation'] as const) {
      expect(resolveStoryLayout(template, content.story_layout)).toBe('legacy')
    }
  })

  it('deve recusar valores inválidos de story_layout e rich_text', () => {
    expect(validateTemplateContent('classic', { story_layout: 'carrossel' })).not.toBeNull()
    expect(validateTemplateContent('classic', { rich_text: 'sim' })).not.toBeNull()
  })

  it('deve ignorar rich_text diferente de true ao ler (ativação só por ação explícita)', () => {
    expect(parseSiteContent({ rich_text: false }).rich_text).toBeUndefined()
    expect(parseSiteContent({ rich_text: 'true' }).rich_text).toBeUndefined()
  })
})
