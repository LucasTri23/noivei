'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const Schema = z.object({
  password:        z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua nova senha'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})
type Fields = z.infer<typeof Schema>

const inputWrapStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #E7E1E4', borderRadius: '12px', padding: '13px 15px',
}
const inputStyle = {
  border: 'none', outline: 'none', fontSize: '15px', color: '#22304F', width: '100%', background: 'transparent',
}

// Destino do link de "esqueci minha senha" (ver forgot-password/page.tsx e
// /auth/callback?type=recovery) — troca a senha usando a sessão de recuperação já
// estabelecida pelo exchangeCodeForSession no callback. Sem sessão de recuperação
// válida (link expirado/já usado/acesso direto), updateUser falha e mostramos um
// caminho pra pedir um novo link, em vez de deixar o formulário quebrado sem explicação.
export default function ResetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession]           = useState(false)
  const [done, setDone]                       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [serverError, setServerError]         = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(Schema),
  })

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(Boolean(user))
      setCheckingSession(false)
    })
  }, [])

  async function onSubmit(data: Fields) {
    setLoading(true)
    setServerError('')

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password: data.password })

    setLoading(false)
    if (error) {
      setServerError(
        error.message.includes('different from the old password')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.',
      )
      return
    }
    setDone(true)
  }

  if (checkingSession) return null

  if (!hasSession) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#FBEEF0', color: '#E86A78', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: '30px', margin: '0 0 8px', color: '#22304F' }}>
          Link expirado ou inválido
        </h1>
        <p style={{ fontSize: '14.5px', color: '#6E6A72', lineHeight: 1.6, marginBottom: '28px' }}>
          Esse link de redefinição de senha não é mais válido. Solicite um novo.
        </p>
        <Link href="/forgot-password"
          style={{ display: 'inline-block', background: '#22304F', color: '#fff', borderRadius: '12px', padding: '14px 28px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
          Solicitar novo link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#E9F3EC', color: '#4C9A6A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: '30px', margin: '0 0 8px', color: '#22304F' }}>
          Senha redefinida!
        </h1>
        <p style={{ fontSize: '14.5px', color: '#6E6A72', lineHeight: 1.6, marginBottom: '28px' }}>
          Sua senha foi alterada com sucesso. Entre com a nova senha.
        </p>
        <Link href="/login"
          style={{ display: 'inline-block', background: '#22304F', color: '#fff', borderRadius: '12px', padding: '14px 28px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
          Entrar
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4vw,38px)', margin: '6px 0 4px', color: '#22304F' }}>
        Definir nova senha
      </h1>
      <p style={{ fontSize: '14.5px', color: '#6E6A72', margin: '0 0 26px', lineHeight: 1.6 }}>
        Escolha uma nova senha para a sua conta.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={inputWrapStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9099" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input {...register('password')} type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)" style={inputStyle} />
        </div>
        {errors.password && <p style={{ fontSize: '12px', color: '#E86A78', marginTop: '-10px' }}>{errors.password.message}</p>}

        <div style={inputWrapStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9099" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input {...register('confirmPassword')} type="password" autoComplete="new-password" placeholder="Confirme a nova senha" style={inputStyle} />
        </div>
        {errors.confirmPassword && <p style={{ fontSize: '12px', color: '#E86A78', marginTop: '-10px' }}>{errors.confirmPassword.message}</p>}

        {serverError && (
          <p style={{ fontSize: '13.5px', color: '#E86A78', background: '#FBEEF0', padding: '10px 14px', borderRadius: '10px' }}>
            {serverError}
          </p>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', background: '#E86A78', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 24px rgba(232,106,120,0.3)', marginTop: '8px' }}>
          {loading ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  )
}
