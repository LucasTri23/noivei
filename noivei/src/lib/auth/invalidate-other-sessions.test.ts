import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock é hoisted — factories não podem referenciar variáveis externas, só vi.fn() puro.
vi.mock('@/lib/supabase/service', () => ({
  createSupabaseService: vi.fn(),
}))

import { createSupabaseService } from '@/lib/supabase/service'
import { invalidateOtherSessions } from './invalidate-other-sessions'

const mockedCreateSupabaseService = vi.mocked(createSupabaseService)

function buildServiceClient(signOutError: { message: string } | null = null) {
  const signOut = vi.fn().mockResolvedValue({ data: null, error: signOutError })
  return { client: { auth: { admin: { signOut } } }, signOut }
}

describe('invalidateOtherSessions', () => {
  beforeEach(() => {
    mockedCreateSupabaseService.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('chama admin.signOut com o access_token da sessão atual e scope "others"', async () => {
    const { client, signOut } = buildServiceClient()
    mockedCreateSupabaseService.mockReturnValue(client as never)

    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok-atual' } } }),
      },
    }

    await invalidateOtherSessions(supabase as never)

    expect(signOut).toHaveBeenCalledWith('tok-atual', 'others')
  })

  it('não chama admin.signOut quando não há sessão/access_token disponível', async () => {
    const { client, signOut } = buildServiceClient()
    mockedCreateSupabaseService.mockReturnValue(client as never)

    const supabase = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    }

    await invalidateOtherSessions(supabase as never)

    expect(signOut).not.toHaveBeenCalled()
  })

  it('nunca lança quando a Admin API retorna erro — só loga', async () => {
    const { client } = buildServiceClient({ message: 'falha simulada' })
    mockedCreateSupabaseService.mockReturnValue(client as never)

    const supabase = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
    }

    await expect(invalidateOtherSessions(supabase as never)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })

  it('nunca lança quando getSession rejeita inesperadamente — só loga', async () => {
    const supabase = {
      auth: { getSession: vi.fn().mockRejectedValue(new Error('falha de rede')) },
    }

    await expect(invalidateOtherSessions(supabase as never)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
