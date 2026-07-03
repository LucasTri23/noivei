'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
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
  const [serverError, setServerError] = useState('')
  const [saved, setSaved]             = useState(false)
  const [loading, setLoading]         = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFields>({
    resolver: zodResolver(PasswordSchema),
  })

  async function onSubmit(data: PasswordFields) {
    setLoading(true)
    setServerError('')
    setSaved(false)

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password: data.password })

    setLoading(false)
    if (error) {
      setServerError(
        error.message.includes('different from the old password')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível alterar a senha. Tente novamente.',
      )
      return
    }
    setSaved(true)
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

      {serverError && (
        <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', margin: 0 }}>
          {serverError}
        </p>
      )}
      {saved && (
        <p style={{ fontSize: '13.5px', color: '#5E8B6A', background: '#E9EFE6', padding: '10px 14px', borderRadius: '10px', margin: 0 }}>
          Senha alterada com sucesso.
        </p>
      )}

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
