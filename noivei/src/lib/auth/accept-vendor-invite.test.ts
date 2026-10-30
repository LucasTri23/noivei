import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { acceptVendorInvite } from './accept-vendor-invite'

describe('aceitar convite de fornecedor', () => {
  it('remove o fragmento antes de criar o client e estabelece a sessão pelos tokens', async () => {
    const clear = vi.fn()
    const setSession = vi.fn().mockResolvedValue({ data: { user: { id: 'vendor' } }, error: null })
    const getClient = vi.fn(() => {
      expect(clear).toHaveBeenCalledOnce()
      return { auth: { setSession } } as unknown as SupabaseClient
    })
    const valid = await acceptVendorInvite(new URL('https://example.com/reset-password?next=/fornecedor#type=invite&access_token=access&refresh_token=refresh'), clear, getClient)
    expect(valid).toBe(true)
    expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
  })
  it('não usa sessão anterior quando o convite está expirado', async () => {
    const getClient = vi.fn()
    const valid = await acceptVendorInvite(new URL('https://example.com/reset-password?next=/fornecedor#error=access_denied'), vi.fn(), getClient)
    expect(valid).toBe(false)
    expect(getClient).not.toHaveBeenCalled()
  })
  it('rejeita tokens incompletos', async () => {
    const getClient = vi.fn()
    expect(await acceptVendorInvite(new URL('https://example.com/reset-password#type=invite&access_token=access'), vi.fn(), getClient)).toBe(false)
    expect(getClient).not.toHaveBeenCalled()
  })
  it('preserva a recuperação de senha normal por PKCE', async () => {
    const clear = vi.fn()
    const getClient = vi.fn()
    expect(await acceptVendorInvite(new URL('https://example.com/reset-password?code=pkce'), clear, getClient)).toBeNull()
    expect(clear).not.toHaveBeenCalled()
    expect(getClient).not.toHaveBeenCalled()
  })
})
