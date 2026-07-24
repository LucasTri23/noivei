'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const Schema = z.object({ email: z.string().email('E-mail inválido') })
type Fields = z.infer<typeof Schema>

export default function ForgotPasswordPage() {
  const [sent, setSent]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: Fields) {
    setLoading(true)
    setServerError('')

    const limitCheck = await fetch('/api/v1/auth/check-rate-limit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'forgot_password', identifier: data.email }),
    })
    if (!limitCheck.ok) {
      const body = await limitCheck.json().catch(() => null)
      setServerError(body?.error?.message ?? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
      setLoading(false)
      return
    }

    const supabase = createSupabaseBrowser()
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#FBEEF0', color: '#E86A78', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="m2 6 10 7 10-7"/><path d="m16 19 2 2 4-4"/></svg>
        </div>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: '32px', margin: '0 0 8px', color: '#22304F' }}>
          E-mail enviado!
        </h1>
        <p style={{ fontSize: '14.5px', color: '#6E6A72', lineHeight: 1.6, marginBottom: '28px' }}>
          Verifique sua caixa de entrada e clique no link para redefinir sua senha.
        </p>
        <Link href="/login"
          style={{ display: 'inline-block', background: '#22304F', color: '#fff', borderRadius: '12px', padding: '14px 28px', fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
          Voltar para entrar
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: '#6E6A72', textDecoration: 'none', marginBottom: '20px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        Voltar para entrar
      </Link>

      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4vw,38px)', margin: '6px 0 4px', color: '#22304F' }}>
        Recuperar acesso
      </h1>
      <p style={{ fontSize: '14.5px', color: '#6E6A72', margin: '0 0 26px', lineHeight: 1.6 }}>
        Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1.5px solid #E7E1E4', borderRadius: '12px', padding: '13px 15px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9099" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
          <input {...register('email')} type="email" placeholder="Seu e-mail"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#22304F', width: '100%', background: 'transparent' }} />
        </div>
        {errors.email && <p style={{ fontSize: '12px', color: '#E86A78', marginTop: '-10px' }}>{errors.email.message}</p>}

        {serverError && (
          <p style={{ fontSize: '13.5px', color: '#E86A78', background: '#FBEEF0', padding: '10px 14px', borderRadius: '10px' }}>
            {serverError}
          </p>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', background: '#E86A78', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 24px rgba(232,106,120,0.3)', marginTop: '8px' }}>
          {loading ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>
    </div>
  )
}
