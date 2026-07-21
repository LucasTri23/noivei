'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import Spinner from '@/components/ui/spinner'
import type { Guest } from '@/types/database'

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

const STATUS_LABELS: Record<string, string> = {
  confirmado: 'Confirmado',
  pendente:   'Pendente',
  recusado:   'Recusado',
}

function csvEscape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function buildGuestsCsv(guests: Guest[]): string {
  const header = ['Grupo', 'Nome', 'Status', 'E-mail', 'Telefone']
  const sorted = [...guests].sort((a, b) => {
    const groupA = a.group_name ?? 'Sem grupo'
    const groupB = b.group_name ?? 'Sem grupo'
    return groupA.localeCompare(groupB, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR')
  })

  const rows = sorted.map((g) => [
    g.group_name ?? 'Sem grupo',
    g.name,
    STATUS_LABELS[g.status] ?? g.status,
    g.email ?? '',
    g.phone ?? '',
  ].map(csvEscape).join(';'))

  // BOM (U+FEFF) para o Excel abrir acentos corretamente
  const bom = String.fromCharCode(0xfeff)
  return bom + [header.join(';'), ...rows].join('\r\n')
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

    const { data: guests, error: guestsError } = await supabase
      .from('guests')
      .select('*')
      .eq('wedding_id', wedding.id)

    setLoading(false)
    if (guestsError) {
      toastError('Não foi possível exportar seus dados. Tente novamente.')
      return
    }
    if (!guests || guests.length === 0) {
      toastError('Você ainda não cadastrou convidados para exportar.')
      return
    }

    const csv  = buildGuestsCsv(guests as Guest[])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `convidados-noivei-${new Date().toISOString().slice(0, 10)}.csv`
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
