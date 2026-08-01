'use client'

import { useState } from 'react'
import { toastError, toastSuccess } from '@/store/toast.store'

interface ResetPreferencesButtonProps {
  userId:    string
  userLabel: string
}

interface ApiErrorBody {
  error?: { message?: string }
}

export default function ResetPreferencesButton({ userId, userLabel }: ResetPreferencesButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    if (!window.confirm(`Limpar as respostas do questionário de "${userLabel}"? Na próxima vez que abrir o questionário de personalização, vai começar em branco.`)) return

    setLoading(true)
    const res = await fetch(`/api/v1/admin/users/${userId}/reset-preferences`, { method: 'POST' })
    setLoading(false)

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null
      toastError(body?.error?.message ?? 'Não foi possível limpar as respostas.')
      return
    }

    toastSuccess('Respostas do questionário limpas.')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        border: '1px solid #E0B870', background: 'transparent', color: '#9A7020',
        borderRadius: '8px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
      }}
    >
      {loading ? 'Limpando…' : 'Resetar questionário'}
    </button>
  )
}
