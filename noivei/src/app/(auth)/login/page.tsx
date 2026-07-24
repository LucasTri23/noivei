'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const LoginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type LoginFields = z.infer<typeof LoginSchema>

const inputStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'
  const [serverError, setServerError] = useState('')
  const [loading, setLoading]         = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(LoginSchema),
  })

  async function onSubmit(data: LoginFields) {
    setLoading(true)
    setServerError('')

    const limitCheck = await fetch('/api/v1/auth/check-rate-limit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'login', identifier: data.email }),
    })
    if (!limitCheck.ok) {
      const body = await limitCheck.json().catch(() => null)
      setServerError(body?.error?.message ?? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
      setLoading(false)
      return
    }

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({
      email:    data.email,
      password: data.password,
    })
    if (error) {
      setServerError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  async function handleGoogle() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    })
  }

  return (
    <div>
      <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C6943A', fontWeight: 700 }}>
        Bem-vindo de volta
      </div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4vw,38px)', margin: '8px 0 4px', color: '#3C2818' }}>
        Entrar
      </h1>
      <p style={{ fontSize: '14.5px', color: '#9A7A60', margin: '0 0 26px' }}>
        Continue de onde parou o planejamento.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
          <input {...register('email')} type="email" placeholder="Seu e-mail"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.email && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.email.message}</p>}

        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input {...register('password')} type="password" placeholder="Sua senha"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.password && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.password.message}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Link href="/forgot-password" style={{ fontSize: '13.5px', color: '#C6943A', fontWeight: 600 }}>
            Esqueci a senha
          </Link>
        </div>

        {serverError && (
          <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px' }}>
            {serverError}
          </p>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', background: '#C6943A', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 24px rgba(198,148,58,0.32)' }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '22px 0', color: '#C8B4A0', fontSize: '12.5px' }}>
        <span style={{ flex: 1, height: '1px', background: '#EBDDD0' }} /> ou <span style={{ flex: 1, height: '1px', background: '#EBDDD0' }} />
      </div>

      <button onClick={handleGoogle}
        style={{ width: '100%', background: '#fff', color: '#3C2818', border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px', fontWeight: 600, fontSize: '14.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'sans-serif', fontWeight: 700, color: '#4285F4' }}>G</span>
        Continuar com Google
      </button>

      <div style={{ textAlign: 'center', marginTop: '26px', fontSize: '14px', color: '#9A7A60' }}>
        Ainda não tem conta?{' '}
        <Link href="/signup" style={{ color: '#C6943A', fontWeight: 600 }}>Criar conta</Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ height: '400px' }} />}>
      <LoginForm />
    </Suspense>
  )
}
