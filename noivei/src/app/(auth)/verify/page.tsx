'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

// Campo único (em vez de N caixas separadas, uma por dígito) de propósito: o
// tamanho do código de confirmação é definido pelo próprio Supabase (painel do
// projeto), não é fixo em 6 dígitos — travar a UI num número exato de caixas quebra
// assim que o projeto usa um tamanho diferente. Um input só aceita qualquer tamanho.
function VerifyForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const email        = searchParams.get('email') ?? ''
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(val: string) {
    setCode(val.replace(/\D/g, '').slice(0, 12))
  }

  async function handleConfirm() {
    const token = code
    if (token.length < 6) { setError('Digite o código recebido por e-mail.'); return }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    if (verifyError) {
      setError('Código inválido ou expirado. Tente reenviar.')
      setLoading(false)
      return
    }
    router.push('/onboarding')
  }

  async function handleResend() {
    setCode('')
    setError('')
    const supabase = createSupabaseBrowser()
    await supabase.auth.resend({ type: 'signup', email })
  }

  return (
    <div>
      <div
        style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: '#FBF5EE', color: '#C6943A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/>
          <path d="m2 6 10 7 10-7"/>
          <path d="m16 19 2 2 4-4"/>
        </svg>
      </div>

      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(28px,3.8vw,36px)', margin: '0 0 4px', color: '#3C2818' }}>
        Verifique seu e-mail
      </h1>
      <p style={{ fontSize: '14.5px', color: '#9A7A60', margin: '0 0 26px', lineHeight: 1.6 }}>
        Enviamos um código de confirmação para{' '}
        <strong style={{ color: '#3C2818' }}>{email || 'seu e-mail'}</strong>.
      </p>

      <input
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Código"
        aria-label="Código de confirmação"
        style={{
          width: '100%', textAlign: 'center', marginBottom: '24px',
          fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600,
          letterSpacing: '0.3em', padding: '14px 10px',
          color: '#3C2818',
          border: `1.5px solid ${code ? '#C6943A' : '#EBDDD0'}`,
          borderRadius: '12px', outline: 'none', background: 'transparent',
          transition: 'border-color 0.18s',
        }}
      />

      {error && (
        <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading}
        style={{
          width: '100%', background: '#C6943A', color: '#fff', border: 'none',
          borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
        }}
      >
        {loading ? 'Verificando…' : 'Confirmar'}
      </button>

      <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '14px', color: '#9A7A60' }}>
        Não recebeu?{' '}
        <button
          onClick={handleResend}
          style={{ color: '#C6943A', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: 0 }}
        >
          Reenviar código
        </button>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ height: '400px' }} />}>
      <VerifyForm />
    </Suspense>
  )
}
