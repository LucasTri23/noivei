'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'

interface AcceptInviteButtonProps {
  token: string
}

interface AcceptInviteErrorBody {
  error?: { message?: string }
}

export default function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)
  // Guarda por ref (não só por state): dois cliques na mesma tick veem `loading`
  // ainda `false` (o setState do primeiro clique não commitou a re-render a
  // tempo), então só o state não bastava pra impedir duas requisições em corrida.
  const submittingRef = useRef(false)

  async function accept() {
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)

    const res = await fetch(`/api/v1/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as AcceptInviteErrorBody | null
      submittingRef.current = false
      setLoading(false)
      toastError(body?.error?.message ?? 'Não foi possível aceitar o convite. Tente novamente.')
      return
    }

    toastSuccess('Convite aceito! Bem-vindo(a) ao casamento.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <button
      onClick={accept}
      disabled={loading}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        background: 'var(--wedding-color)', color: '#fff', border: 'none',
        borderRadius: '14px', padding: '15px 20px',
        fontWeight: 700, fontSize: '15px',
        cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
        boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 35%, transparent)',
      }}
    >
      {showSpinner && <Spinner color="#fff" />}
      Aceitar convite
    </button>
  )
}
