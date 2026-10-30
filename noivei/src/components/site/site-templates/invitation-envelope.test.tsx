import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InvitationEnvelope from './invitation-envelope'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('convite selado', () => {
  it('começa fechado e revela o site ao clicar no selo, sem animar quando solicitado', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(<InvitationEnvelope names="Ana & João" date="22 de maio" initials="A & J"><h1>Site do casal</h1><a href="#rsvp">Presença</a></InvitationEnvelope>)
    expect(screen.queryByRole('heading', { name: 'Site do casal' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir convite de casamento' }))
    expect(screen.getByRole('heading', { name: 'Site do casal' })).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText('Site de casamento de Ana & João')).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Abrir convite de casamento' })).not.toBeInTheDocument()
  })
  it('desativa o selo e conclui a abertura mesmo sem evento de animação do navegador', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    render(<InvitationEnvelope names="Ana & João" date={null} initials="A & J"><h1>Site do casal</h1></InvitationEnvelope>)
    const button = screen.getByRole('button', { name: 'Abrir convite de casamento' })
    const gate = button.parentElement!.parentElement!
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Site do casal' })).toBeVisible()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(gate).not.toBeInTheDocument()
  })
})


it('mostra a dedicatória e a instrução personalizadas do casal', () => {
  render(<InvitationEnvelope names="Ana & João" date={null} initials="A & J" caption="Para nossa família" openingHint="Abra esta lembrança"><p>Nosso convite</p></InvitationEnvelope>)
  expect(screen.getByText('Para nossa família')).toBeInTheDocument()
  expect(screen.getByText('Abra esta lembrança')).toBeVisible()
  expect(screen.queryByText('Toque no selo dourado para abrir')).not.toBeInTheDocument()
})
