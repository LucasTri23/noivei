import { describe, expect, it } from 'vitest'

import { insertLink, toggleInlineFormat } from './format-selection'
import { toSafeLinkHref } from './safe-url'

describe('toggleInlineFormat', () => {
  it('deve envolver a seleção e manter o texto selecionado', () => {
    const result = toggleInlineFormat({ value: 'nosso dia', start: 0, end: 5 }, '**')
    expect(result).toEqual({ value: '**nosso** dia', start: 2, end: 7 })
  })

  it('deve deixar espaços das pontas fora do marcador', () => {
    expect(toggleInlineFormat({ value: 'a lindo b', start: 1, end: 8 }, '*').value).toBe('a *lindo* b')
  })

  it('deve remover a formatação quando a seleção já está envolvida', () => {
    expect(toggleInlineFormat({ value: '**nosso** dia', start: 2, end: 7 }, '**')).toEqual({ value: 'nosso dia', start: 0, end: 5 })
  })

  it('não deve confundir negrito com itálico ao alternar itálico', () => {
    expect(toggleInlineFormat({ value: '**nosso**', start: 2, end: 7 }, '*').value).toBe('***nosso***')
  })

  it('deve inserir texto de exemplo selecionado quando não há seleção', () => {
    const result = toggleInlineFormat({ value: 'oi ', start: 3, end: 3 }, '~~')
    expect(result.value).toBe('oi ~~texto tachado~~')
    expect(result.value.slice(result.start, result.end)).toBe('texto tachado')
  })
})

describe('insertLink', () => {
  it('deve usar a seleção como texto e selecionar o endereço para digitar', () => {
    const result = insertLink({ value: 'veja o álbum', start: 7, end: 12 })
    expect(result.value).toBe('veja o [álbum](https://)')
    expect(result.value.slice(result.start, result.end)).toBe('https://')
  })
})

describe('toSafeLinkHref', () => {
  it.each(['https://exemplo.com', 'http://exemplo.com/a?b=1', 'mailto:casal@exemplo.com'])('deve aceitar %s', (url) => {
    expect(toSafeLinkHref(url)).not.toBeNull()
  })

  it.each(['javascript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', '/relativo', '//sem-protocolo.com', 'https://', '', null])(
    'deve recusar %s',
    (url) => {
      expect(toSafeLinkHref(url)).toBeNull()
    },
  )
})
