import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StyleContentFields from './style-content-fields'
describe('campos do estilo escolhido', () => {
  it('troca os campos quando o modelo muda e informa a quantidade de fotos', () => {
    const change = vi.fn()
    const view = render(<StyleContentFields monogramEnabled template="editorial" content={{}} onChange={change} />)
    expect(screen.getByLabelText('Título da história')).toBeVisible()
    expect(screen.getByText(/até 8 fotos/)).toBeVisible()
    expect(screen.queryByLabelText('Dedicatória no envelope')).not.toBeInTheDocument()
    view.rerender(<StyleContentFields monogramEnabled template="invitation" content={{}} onChange={change} />)
    expect(screen.queryByLabelText('Título da história')).not.toBeInTheDocument()
    expect(screen.getByText(/até 6 fotos/)).toBeVisible()
    fireEvent.change(screen.getByLabelText('Dedicatória no envelope'), { target: { value: 'Para nossa família' } })
    expect(change).toHaveBeenCalledWith('envelope_caption', 'Para nossa família')
  })
  it('oferece monograma no Clássico a partir do Ideal', () => {
    const change = vi.fn()
    render(<StyleContentFields monogramEnabled template="classic" content={{}} onChange={change} />)
    fireEvent.change(screen.getByLabelText('Monograma do casal'), { target: { value: 'A & J' } })
    expect(change).toHaveBeenCalledWith('envelope_monogram', 'A & J')
  })
  it('oculta o monograma no Gratuito', () => {
    render(<StyleContentFields monogramEnabled={false} template="classic" content={{}} onChange={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(/8 primeiras fotos/)).toBeVisible()
  })
})
