'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const SignupSchema = z.object({
  full_name:       z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email:           z.string().email('E-mail inválido'),
  password:        z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua senha'),
  terms:           z.literal(true, { error: 'Você deve aceitar os termos' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})
type SignupFields = z.infer<typeof SignupSchema>

const inputStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
}

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading]         = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFields>({
    resolver: zodResolver(SignupSchema),
  })

  async function onSubmit(data: SignupFields) {
    setLoading(true)
    setServerError('')
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setServerError(error.message)
      setLoading(false)
      return
    }
    router.push(`/verify?email=${encodeURIComponent(data.email)}`)
  }

  async function handleGoogle() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
  }

  return (
    <div>
      <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C6943A', fontWeight: 700 }}>
        Comece de graça
      </div>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4vw,38px)', margin: '8px 0 4px', color: '#3C2818' }}>
        Criar sua conta
      </h1>
      <p style={{ fontSize: '14.5px', color: '#9A7A60', margin: '0 0 26px' }}>
        Organize seu casamento do início ao fim.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input {...register('full_name')} placeholder="Seu nome"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.full_name && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.full_name.message}</p>}

        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
          <input {...register('email')} type="email" placeholder="Seu e-mail"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.email && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.email.message}</p>}

        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input {...register('password')} type="password" placeholder="Crie uma senha (mín. 8 caracteres)"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.password && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.password.message}</p>}

        <div style={inputStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input {...register('confirmPassword')} type="password" placeholder="Confirme sua senha"
            style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }} />
        </div>
        {errors.confirmPassword && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.confirmPassword.message}</p>}

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
          color: '#9A7A60', cursor: 'pointer', fontSize: '13px', lineHeight: 1.55,
        }}>
          <input {...register('terms')} type="checkbox" style={{ accentColor: '#C6943A', width: '16px', height: '16px', marginTop: '1px', flexShrink: 0 }} />
          <span>
            Concordo com os{' '}
            <Link href="/termos" style={{ color: '#C6943A', fontWeight: 600 }}>Termos</Link>
            {' '}e a{' '}
            <Link href="/privacidade" style={{ color: '#C6943A', fontWeight: 600 }}>Política de Privacidade</Link>.
          </span>
        </label>
        {errors.terms && <p style={{ fontSize: '12px', color: '#C0553F', marginTop: '-10px' }}>{errors.terms.message}</p>}

        {serverError && (
          <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px' }}>
            {serverError}
          </p>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', background: '#C6943A', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 24px rgba(198,148,58,0.32)' }}>
          {loading ? 'Criando conta…' : 'Criar conta'}
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
        Já tem conta?{' '}
        <Link href="/login" style={{ color: '#C6943A', fontWeight: 600 }}>Entrar</Link>
      </div>
    </div>
  )
}
