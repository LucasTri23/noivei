import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RsvpForm from './rsvp-form'

const baseProps = {
  token:             'a-valid-rsvp-token-1234',
  initialPartySize:  1,
  initialCompanions: [],
  siteSlug:          null,
}

describe('RsvpForm', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deve mostrar o formulário editável quando o convite ainda está pendente', () => {
    render(<RsvpForm {...baseProps} initialStatus="pendente" />)

    expect(screen.getByLabelText('Telefone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sim, estarei lá!/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Não poderei ir/ })).toBeInTheDocument()
  })

  it('deve travar o formulário (sem campos nem botões) quando o convite já foi confirmado antes', () => {
    render(<RsvpForm {...baseProps} initialStatus="confirmado" />)

    expect(screen.getByText('Você já confirmou presença a este convite.')).toBeInTheDocument()
    expect(screen.getByText('Se precisar alterar sua resposta, peça um novo link ao casal.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Telefone')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sim, estarei lá!/ })).not.toBeInTheDocument()
  })

  it('deve travar o formulário quando o convite já foi recusado antes', () => {
    render(<RsvpForm {...baseProps} initialStatus="recusado" />)

    expect(screen.getByText('Você já recusou este convite.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Telefone')).not.toBeInTheDocument()
  })

  it('deve travar o formulário quando o servidor rejeita o envio com ALREADY_RESPONDED', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok:   false,
      json: async () => ({
        error: { code: 'ALREADY_RESPONDED', message: 'Este convite já foi respondido e não pode ser alterado por este link.' },
      }),
    })

    render(<RsvpForm {...baseProps} initialStatus="pendente" />)

    await user.type(screen.getByLabelText('Telefone'), '11999999999')
    await user.click(screen.getByRole('button', { name: /Sim, estarei lá!/ }))

    expect(await screen.findByText('Este convite já foi respondido.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Telefone')).not.toBeInTheDocument()
  })
})
