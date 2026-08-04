import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Skeleton from './skeleton'
import GuestsListSkeleton from '@/components/guests/guests-list-skeleton'

describe('Skeleton', () => {
  it('deve renderizar com aria-hidden="true" quando montado', () => {
    render(<Skeleton data-testid="skeleton-brick" />)

    const el = screen.getByTestId('skeleton-brick')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('deve aplicar width, height e border-radius customizados quando informados via props', () => {
    render(<Skeleton data-testid="skeleton-brick" width="222px" height="33px" radius="4px" />)

    const el = screen.getByTestId('skeleton-brick')
    expect(el).toHaveStyle({ width: '222px', height: '33px', borderRadius: '4px' })
  })

  it('deve usar valores padrão baseados nos tokens do design system quando nenhuma prop é informada', () => {
    render(<Skeleton data-testid="skeleton-brick" />)

    const el = screen.getByTestId('skeleton-brick')
    expect(el).toHaveStyle({ width: '100%', height: '1rem', borderRadius: 'var(--radius)' })
  })
})

describe('GuestsListSkeleton', () => {
  it('deve renderizar sem erro e marcar o container de linhas fantasma com aria-hidden quando montado', () => {
    const { container } = render(<GuestsListSkeleton />)

    const hiddenContainer = container.querySelector('[aria-hidden="true"]')
    expect(hiddenContainer).not.toBeNull()
  })

  it('deve expor um aviso de carregamento acessível para leitor de tela quando montado', () => {
    render(<GuestsListSkeleton />)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando convidados…')
  })
})
