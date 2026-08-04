import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import GuestsManager from './guests-manager'
import type { Guest } from '@/types/database'

const guest: Guest = {
  id:              'g1',
  wedding_id:      'w1',
  name:            'Maria Silva',
  group_name:      null,
  status:          'pendente',
  rsvp_token:      'tok-1',
  email:           null,
  phone:           null,
  party_size:      1,
  attending_count: null,
  parent_guest_id: null,
  invite_sent_at:  null,
  checked_in_at:   null,
  created_at:      '2026-01-01T00:00:00.000Z',
}

function renderManager() {
  return render(
    <GuestsManager
      weddingId="w1"
      initialGuests={[guest]}
      guestLimit={100}
      rsvpMessageTemplate={null}
      coupleNames="Maria & João"
      weddingColor="#8A5A44"
      weddingColorSecondary="#D9B08C"
      checkinEnabled
    />,
  )
}

describe('GuestsManager', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('modal de remoção de convidado', () => {
    it('deve abrir com o nome correto do convidado quando o botão de remover da linha é clicado', async () => {
      const user = userEvent.setup()
      renderManager()

      await user.click(screen.getByRole('button', { name: 'Remover Maria Silva' }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByRole('heading', { name: 'Remover convidado?' })).toBeInTheDocument()
      expect(within(dialog).getByText((_, node) => node?.textContent === 'Maria Silva')).toBeInTheDocument()
    })

    it('não deve remover o convidado quando "Cancelar" é clicado', async () => {
      const user = userEvent.setup()
      renderManager()

      await user.click(screen.getByRole('button', { name: 'Remover Maria Silva' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    })

    it('deve chamar a API de remoção quando "Remover convidado" é clicado', async () => {
      const user = userEvent.setup()
      renderManager()

      await user.click(screen.getByRole('button', { name: 'Remover Maria Silva' }))
      await user.click(screen.getByRole('button', { name: 'Remover convidado' }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/weddings/w1/guests/g1', { method: 'DELETE' })
      })
    })

    it('não deve disparar duas chamadas à API quando o botão de remover é clicado duas vezes rapidamente', async () => {
      const user = userEvent.setup()
      renderManager()

      await user.click(screen.getByRole('button', { name: 'Remover Maria Silva' }))

      const confirmButton = screen.getByRole('button', { name: 'Remover convidado' })
      // fireEvent (não userEvent) de propósito: dispara os dois cliques na mesma
      // tick síncrona, sem esperar o primeiro clique terminar — é exatamente a
      // condição de corrida que o deletingRef precisa bloquear.
      fireEvent.click(confirmButton)
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })
  })
})
