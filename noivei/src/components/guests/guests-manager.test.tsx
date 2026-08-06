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

const companion: Guest = {
  id:              'g2',
  wedding_id:      'w1',
  name:            'Ana',
  group_name:      null,
  status:          'confirmado',
  rsvp_token:      'tok-2',
  email:           null,
  phone:           null,
  party_size:      1,
  attending_count: null,
  parent_guest_id: 'g1',
  invite_sent_at:  null,
  checked_in_at:   null,
  created_at:      '2026-01-01T00:00:00.000Z',
}

function renderManager(guests: Guest[] = [guest]) {
  return render(
    <GuestsManager
      weddingId="w1"
      initialGuests={guests}
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

  describe('acompanhantes', () => {
    it('não deve renderizar acompanhante como linha própria, mas deve listar o nome na linha do convidado principal', () => {
      renderManager([guest, companion])

      expect(screen.getByText((_, node) => node?.textContent === 'Acompanhantes: Ana')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remover Ana' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Editar Ana' })).not.toBeInTheDocument()
    })

    it('deve pré-preencher o nome do acompanhante existente ao editar o convidado principal e salvar deve fazer PATCH no acompanhante quando o nome muda', async () => {
      const user = userEvent.setup()
      fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'PATCH' && url === '/api/v1/weddings/w1/guests/g1') {
          return Promise.resolve({ ok: true, json: async () => ({ data: guest }) } as Response)
        }
        if (opts?.method === 'PATCH' && url === '/api/v1/weddings/w1/guests/g2') {
          return Promise.resolve({
            ok:   true,
            json: async () => ({ data: { ...companion, name: 'Ana Paula' } }),
          } as Response)
        }
        return Promise.resolve({ ok: true } as Response)
      })

      renderManager([guest, companion])

      await user.click(screen.getByRole('button', { name: 'Editar Maria Silva' }))

      const companionInput = screen.getByLabelText('Nome do acompanhante 1')
      expect(companionInput).toHaveValue('Ana')

      await user.clear(companionInput)
      await user.type(companionInput, 'Ana Paula')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/weddings/w1/guests/g2',
          expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Ana Paula' }) }),
        )
      })
    })
  })

  describe('grupo', () => {
    it('deve selecionar "Outro" e preservar o valor existente quando group_name não bate com nenhum grupo padrão', async () => {
      const user = userEvent.setup()
      const customGroupGuest: Guest = { ...guest, group_name: 'Amigos do trabalho' }
      renderManager([customGroupGuest])

      await user.click(screen.getByRole('button', { name: 'Editar Maria Silva' }))

      expect(screen.getByLabelText('Grupo')).toHaveValue('outro')
      expect(screen.getByLabelText('Grupo personalizado')).toHaveValue('Amigos do trabalho')
    })
  })
})
