import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import StoryPreview from '@/components/site/story/story-preview'
import { buildStoryView } from '@/lib/site/story/story-model'

import RichTextEditor from './rich-text-editor'

function Harness({ markdown, initial = '' }: { markdown: boolean; initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <RichTextEditor id="campo" value={value} onChange={setValue} markdown={markdown} maxLength={200} />
      <output data-testid="valor">{value}</output>
    </>
  )
}

describe('RichTextEditor', () => {
  it('deve ser o textarea simples de antes quando a formatação está desligada', () => {
    render(<Harness markdown={false} initial="texto" />)
    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Negrito' })).toBeNull()
  })

  it('deve aplicar negrito na seleção pelo botão, sem o usuário digitar Markdown', () => {
    render(<Harness markdown initial="nosso dia" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 5)
    fireEvent.click(screen.getByRole('button', { name: 'Negrito' }))
    expect(screen.getByTestId('valor').textContent).toBe('**nosso** dia')
  })

  it('deve aplicar itálico com Ctrl+I', () => {
    render(<Harness markdown initial="lindo" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 5)
    fireEvent.keyDown(textarea, { key: 'i', ctrlKey: true })
    expect(screen.getByTestId('valor').textContent).toBe('*lindo*')
  })

  it('deve visualizar com o mesmo renderizador do site, sem executar HTML', () => {
    render(<Harness markdown initial={'**oi** <img src=x onerror=alert(1)>'} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))
    expect(document.querySelector('[aria-live] strong')?.textContent).toBe('oi')
    expect(document.querySelector('img')).toBeNull()
  })
})

describe('StoryPreview', () => {
  const data = {
    moments: [{ id: 'm1', title: 'Pedido', description: null, happened_on: null, date_precision: 'day' as const, sort_order: 0 }],
    photos:  [{ id: 'p1', url: 'https://cdn.test/w1/story-1.jpg', caption: 'Praia', moment_id: null, sort_order: 0, width: null, height: null, position_y: 50, fit_contain: false }],
  }

  it('deve avisar que a apresentação original continua igual quando nenhum modo foi escolhido', () => {
    render(<StoryPreview template="classic" view={buildStoryView('classic', undefined, 'x', data)} coupleNames="Ana & João" markdown={false} />)
    expect(screen.getByText(/continua exatamente como no site publicado/)).toBeTruthy()
  })

  it.each(['classic', 'portfolio', 'editorial', 'garden', 'invitation'] as const)('deve renderizar a história real do estilo %s', (template) => {
    const { container } = render(
      <StoryPreview template={template} view={buildStoryView(template, 'illustrated', 'Era uma vez', data)} coupleNames="Ana & João" markdown={false} />,
    )
    expect(container.textContent).toContain('Pedido')
    expect(container.querySelector('img[src="https://cdn.test/w1/story-1.jpg"]')).not.toBeNull()
  })
})
