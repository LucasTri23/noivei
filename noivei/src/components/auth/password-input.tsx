'use client'

import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface PasswordInputProps {
  id:          string
  placeholder: string
  register:    UseFormRegisterReturn
}

const wrapStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C89070" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 1 12s4 8 11 8a9.26 9.26 0 0 0 5.39-1.61M9.5 9.5a3 3 0 1 0 4.24 4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Campo de senha com botão de mostrar/ocultar — usado em login e cadastro (mesmo
// visual/cores das duas telas, por isso extraído em vez de duplicado).
export default function PasswordInput({ id, placeholder, register }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={wrapStyle}>
      <LockIcon />
      <input
        {...register}
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
