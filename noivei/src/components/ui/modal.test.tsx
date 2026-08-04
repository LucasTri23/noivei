import { useState } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Modal from './modal'

// Componente auxiliar pra testar a devolução de foco: precisa de um elemento real
// fora do Modal que recebe o clique de abertura, do mesmo jeito que os botões de
// linha (ex.: "Remover") abrem os modais em guests-manager.tsx.
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir modal</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Título de teste">
        <button>Primeiro</button>
        <button>Segundo</button>
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('deve exibir o título correto quando aberto', () => {
    render(
      <Modal open onClose={vi.fn()} title="Meu título">
        <button>OK</button>
      </Modal>,
    )

    expect(screen.getByRole('heading', { name: 'Meu título' })).toBeInTheDocument()
  })

  it('não deve renderizar nada quando fechado', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Meu título">
        <button>OK</button>
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('deve chamar onClose quando Escape é pressionado com o modal aberto', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        <button>OK</button>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('deve mover o foco para o primeiro elemento focável do modal quando ele abre', () => {
    render(
      <Modal open onClose={vi.fn()} title="Título">
        <button>Primeiro</button>
        <button>Segundo</button>
      </Modal>,
    )

    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus()
  })

  it('não deve deixar o foco escapar dos elementos focáveis do modal enquanto ele está aberto', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={vi.fn()} title="Título">
        <button>Primeiro</button>
        <button>Segundo</button>
      </Modal>,
    )

    const first  = screen.getByRole('button', { name: 'Primeiro' })
    const second = screen.getByRole('button', { name: 'Segundo' })
    expect(first).toHaveFocus()

    await user.tab()
    expect(second).toHaveFocus()

    // Tab a partir do último elemento focável deve voltar pro primeiro, não escapar do modal
    await user.tab()
    expect(first).toHaveFocus()

    // Shift+Tab a partir do primeiro elemento focável deve ir pro último, não escapar do modal
    await user.tab({ shift: true })
    expect(second).toHaveFocus()
  })

  it('deve devolver o foco ao elemento que abriu o modal depois que ele fecha', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const openButton = screen.getByRole('button', { name: 'Abrir modal' })
    await user.click(openButton)

    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()
  })
})
