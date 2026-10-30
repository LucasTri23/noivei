import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VendorNotificationOptIn } from './vendor-chat-notifications'
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })
describe('permissão de notificações', () => {
  it('só pede permissão após clique e permite desativar', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { requestPermission, permission: 'granted' })
    vi.stubGlobal('isSecureContext', true)
    localStorage.clear()
    render(<VendorNotificationOptIn />)
    expect(requestPermission).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desativar notificações' })).toBeVisible())
    expect(requestPermission).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar notificações' }))
    expect(localStorage.getItem('wednest-vendor-chat-notifications')).toBeNull()
  })
})
