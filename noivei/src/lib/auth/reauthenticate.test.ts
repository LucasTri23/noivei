import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/response'
import { reauthenticateWithPassword } from './reauthenticate'

function buildSupabase(signInResult: { error: { message: string } | null }) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: signInResult.error }),
    },
  }
}

describe('reauthenticateWithPassword', () => {
  it('resolve sem lançar quando a senha atual está correta', async () => {
    const supabase = buildSupabase({ error: null })

    await expect(
      reauthenticateWithPassword(supabase as never, { email: 'ana@example.com' }, 'senha-correta'),
    ).resolves.toBeUndefined()

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email:    'ana@example.com',
      password: 'senha-correta',
    })
  })

  it('lança ApiError 401 com mensagem genérica quando a senha atual está errada', async () => {
    const supabase = buildSupabase({ error: { message: 'Invalid login credentials' } })

    const promise = reauthenticateWithPassword(supabase as never, { email: 'ana@example.com' }, 'senha-errada')

    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Senha atual incorreta.' })
  })

  it('lança ApiError 401 sem chamar signInWithPassword quando o usuário não tem e-mail', async () => {
    const supabase = buildSupabase({ error: null })

    const promise = reauthenticateWithPassword(supabase as never, { email: undefined }, 'qualquer')

    await expect(promise).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})
