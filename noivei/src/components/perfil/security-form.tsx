'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'

const PasswordSchema = z.object({
  password:        z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua nova senha'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})
type PasswordFields = z.infer<typeof PasswordSchema>

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: '#FFFFFF', outline: 'none', width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)',
}

export default function SecurityForm() {
  const [loading, setLoading]         = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFields>({
    resolver: zodResolver(PasswordSchema),
  })

  async function onSubmit(data: PasswordFields) {
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password: data.password })

    setLoading(false)
    if (error) {
      toastError(
        error.message.includes('different from the old password')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível alterar a senha. Tente novamente.',
      )
      return
    }
    toastSuccess('Senha alterada com sucesso.')
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="new-password">Nova senha</label>
        <input
          id="new-password"
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          style={inputStyle}
        />
        {errors.password && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.password.message}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="confirm-password">Confirmar nova senha</label>
        <input
          id="confirm-password"
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          style={inputStyle}
        />
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
