import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StyleContentFields from './style-content-fields'
describe('campos do estilo escolhido', () => {
  it('troca os campos quando o modelo muda e informa a quantidade de fotos', () => {
    const change = vi.fn()
    const view = render(<StyleContentFields template="editorial" content={{}} onChange={change} />)
    expect(screen.getByLabelText('Título da história')).toBeVisible()
    expect(screen.getByText(/até 8 fotos/)).toBeVisible()
    expect(screen.queryByLabelText('Dedicatória no envelope')).not.toBeInTheDocument()
    view.rerender(<StyleContentFields template="invitation" content={{}} onChange={change} />)
    expect(screen.queryByLabelText('Título da história')).not.toBeInTheDocument()
    expect(screen.getByText(/até 6 fotos/)).toBeVisible()
    fireEvent.change(screen.getByLabelText('Dedicatória no envelope'), { target: { value: 'Para nossa família' } })
    expect(change).toHaveBeenCalledWith('envelope_caption', 'Para nossa família')
  })
  it('não mostra campos do convite no Clássico', () => {
    render(<StyleContentFields template="classic" content={{}} onChange={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(/8 primeiras fotos/)).toBeVisible()
  })
})
