'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import Spinner from '@/components/ui/spinner'

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export default function ExportDataButton() {
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  async function handleExport() {
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toastError('Sessão expirada. Entre novamente.')
      setLoading(false)
      return
    }

    const wedding = await getUserWedding(supabase, user.id)

    if (!wedding) {
      toastError('Nenhum casamento encontrado para exportar.')
      setLoading(false)
      return
    }

    let response: Response
    try {
      response = await fetch(`/api/v1/weddings/${wedding.id}/export`)
    } catch {
      setLoading(false)
      toastError('Não foi possível exportar seus dados. Tente novamente.')
      return
    }

    setLoading(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
      toastError(body?.error?.message ?? 'Não foi possível exportar seus dados. Tente novamente.')
      return
    }

    const blob = await response.blob()
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dados-wednest-${wedding.id}-${new Date().toISOString().slice(0, 10)}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '13px 16px', borderRadius: '12px',
          border: '1.5px solid #EBDDD0', background: 'transparent',
          cursor: loading ? 'wait' : 'pointer', textAlign: 'left',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <span style={{ color: 'var(--wedding-color)' }}>{showSpinner ? <Spinner size={16} color="var(--wedding-color)" /> : <DownloadIcon />}</span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--wedding-color)' }}>
          {loading ? 'Gerando arquivo…' : 'Exportar meus dados'}
        </span>
      </button>
    </div>
  )
}
