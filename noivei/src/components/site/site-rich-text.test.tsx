import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SiteRichText from './site-rich-text'

function html(text: string, markdown = true): HTMLElement {
  const { container } = render(<SiteRichText text={text} markdown={markdown} />)
  return container
}

describe('SiteRichText', () => {
  describe('compatibilidade (rich_text desligado)', () => {
    it('deve renderizar o mesmo <p> de antes, com o texto literal', () => {
      const container = html('**não é negrito**\n\n<b>x</b>', false)
      const p = container.querySelector('p')
      expect(container.children).toHaveLength(1)
      expect(p?.textContent).toBe('**não é negrito**\n\n<b>x</b>')
      expect(container.querySelector('strong, b')).toBeNull()
    })

    it('deve repassar className e style ao <p>', () => {
      const { container } = render(<SiteRichText text="oi" markdown={false} className="prose" style={{ whiteSpace: 'pre-line' }} />)
      const p = container.querySelector('p')
      expect(p?.className).toBe('prose')
      expect(p?.style.whiteSpace).toBe('pre-line')
    })
  })

  describe('formatação', () => {
    it('deve aplicar negrito, itálico (* e _), negrito+itálico e tachado', () => {
      const container = html('**forte** *ita* _ita2_ ***ambos*** ~~risco~~')
      expect(container.querySelector('strong')?.textContent).toBe('forte')
      expect([...container.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['ita', 'ita2', 'ambos'])
      expect(container.querySelector('em strong, strong em')?.textContent).toBe('ambos')
      expect(container.querySelector('del')?.textContent).toBe('risco')
    })

    it('não deve tratar til simples como tachado', () => {
      const container = html('cerca de ~10 pessoas~')
      expect(container.querySelector('del')).toBeNull()
    })

    it('deve separar parágrafos por linha em branco e manter quebras simples', () => {
      const container = html('linha 1\nlinha 2\n\nparágrafo 2')
      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs).toHaveLength(2)
      expect(paragraphs[0]?.querySelectorAll('br')).toHaveLength(1)
    })

    it('deve manter literais as sintaxes de bloco desativadas', () => {
      const container = html('# Título\n\n- item\n\n> citação\n\n1. um\n\n`código`\n\n---')
      expect(container.querySelector('h1, ul, ol, li, blockquote, code, pre, hr')).toBeNull()
      expect(container.textContent).toContain('# Título')
      expect(container.textContent).toContain('- item')
      expect(container.textContent).toContain('> citação')
      expect(container.textContent).toContain('`código`')
    })

    it('deve renderizar link seguro abrindo em nova aba sem vazar referência', () => {
      const a = html('[nosso álbum](https://exemplo.com/album)').querySelector('a')
      expect(a?.getAttribute('href')).toBe('https://exemplo.com/album')
      expect(a?.getAttribute('target')).toBe('_blank')
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer nofollow ugc')
    })
  })

  describe('segurança', () => {
    it.each([
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<iframe src="https://evil.test"></iframe>',
      '<a href="javascript:alert(1)">x</a>',
      '<div onclick="alert(1)">clique</div>',
    ])('não deve interpretar HTML: %s', (payload) => {
      const root = html(payload).firstElementChild as HTMLElement
      expect(root.querySelector('script, img, iframe, div, [onclick], [onerror]')).toBeNull()
      expect(root.querySelector('a')).toBeNull()
      // O texto aparece escapado, como foi digitado.
      expect(root.textContent).toBe(payload)
    })

    it.each([
      '[x](javascript:alert(1))',
      '[x](JaVaScRiPt:alert(1))',
      '[x](data:text/html;base64,PHNjcmlwdD4=)',
      '[x](vbscript:msgbox(1))',
      '[x](/caminho-relativo)',
      '[x](//evil.test)',
      '[x](file:///etc/passwd)',
    ])('deve neutralizar URL insegura: %s', (payload) => {
      const container = html(payload)
      expect(container.querySelector('a')).toBeNull()
      expect(container.textContent).toContain('x')
    })

    it('não deve renderizar imagens em Markdown', () => {
      const container = html('![foto](https://exemplo.com/foto.png)')
      expect(container.querySelector('img')).toBeNull()
    })
  })
})
