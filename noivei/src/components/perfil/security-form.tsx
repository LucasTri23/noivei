'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import PasswordInput from '@/components/auth/password-input'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'

const PasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual'),
  password:        z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua nova senha'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})
type PasswordFields = z.infer<typeof PasswordSchema>

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)',
}

interface ApiErrorBody {
  error?: { message?: string }
}

// SEC-007: a troca de senha agora acontece nesta rota nova (não mais via
// `supabase.auth.updateUser` direto no client) porque revalidar a senha atual e
// derrubar as demais sessões precisam do service role — só o servidor tem acesso.
export default function SecurityForm() {
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFields>({
    resolver: zodResolver(PasswordSchema),
  })

  async function onSubmit(data: PasswordFields) {
    setLoading(true)

    const response = await fetch('/api/v1/auth/change-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.password }),
    })

    setLoading(false)

    if (!response.ok) {
      const body = (await response.json()) as ApiErrorBody
      toastError(body.error?.message ?? 'Não foi possível alterar a senha. Tente novamente.')
      return
    }

    toastSuccess('Sua senha foi alterada. As demais sessões foram encerradas por segurança.')
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="current-password">Senha atual</label>
        <PasswordInput id="current-password" placeholder="Sua senha atual" register={register('currentPassword')} />
        {errors.currentPassword && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.currentPassword.message}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="new-password">Nova senha</label>
        <PasswordInput id="new-password" placeholder="Mínimo de 8 caracteres" register={register('password')} />
        {errors.password && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.password.message}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="confirm-password">Confirmar nova senha</label>
        <PasswordInput id="confirm-password" placeholder="Repita a nova senha" register={register('confirmPassword')} />
        {errors.confirmPassword && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.confirmPassword.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          background: 'var(--wedding-color)', color: '#fff', border: 'none',
          borderRadius: '12px', padding: '14px 22px', fontWeight: 600, fontSize: '15px',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 10px 24px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          alignSelf: 'flex-start',
        }}
      >
        {showSpinner && <Spinner size={15} color="#fff" />}
        {loading ? 'Alterando…' : 'Alterar senha'}
      </button>
    </form>
  )
}
