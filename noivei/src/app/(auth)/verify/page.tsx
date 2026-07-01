'use client'

import { Suspense, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

function VerifyForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const email        = searchParams.get('email') ?? ''
  const [inputs, setInputs]   = useState(['', '', '', '', '', ''])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const refs = [
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
    useRef<HTMLInputElement>(null), // eslint-disable-line react-hooks/rules-of-hooks
  ]

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next  = [...inputs]
    next[idx]   = digit
    setInputs(next)
    if (digit && idx < 5) refs[idx + 1]?.current?.focus()
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !inputs[idx] && idx > 0) {
      refs[idx - 1]?.current?.focus()
    }
  }

  async function handleConfirm() {
    const token = inputs.join('')
    if (token.length < 6) { setError('Digite o código completo de 6 dígitos.'); return }
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
        Enviamos um código de 6 dígitos para{' '}
        <strong style={{ color: '#3C2818' }}>{email || 'seu e-mail'}</strong>.
      </p>

      <div style={{ display: 'flex', gap: '9px', marginBottom: '24px' }}>
        {inputs.map((val, idx) => (
          <input
            key={idx}
            ref={refs[idx]}
            value={val}
            maxLength={1}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            style={{
              width: '100%', aspectRatio: '1', textAlign: 'center',
              fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600,
              color: '#3C2818',
              border: `1.5px solid ${val ? '#C6943A' : '#EBDDD0'}`,
              borderRadius: '12px', outline: 'none', background: 'transparent',
              transition: 'border-color 0.18s',
            }}
          />
        ))}
      </div>

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
