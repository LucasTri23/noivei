'use client'

import { useState } from 'react'

type Status = 'confirmado' | 'pendente' | 'recusado'
type Filter = 'todos' | Status

interface Guest {
  name: string
  group: string
  status: Status
}

// Sem dados padrão ainda — lista vazia até o casal cadastrar convidados
const GUESTS: Guest[] = []

const STATS = {
  total:      GUESTS.length,
  confirmado: GUESTS.filter((g) => g.status === 'confirmado').length,
  pendente:   GUESTS.filter((g) => g.status === 'pendente').length,
  recusado:   GUESTS.filter((g) => g.status === 'recusado').length,
}

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmado', color: '#5E8B6A', bg: '#E9EFE6' },
  pendente:   { label: 'Pendente',   color: 'var(--wedding-color-dark)', bg: 'var(--wedding-color-subtle)' },
  recusado:   { label: 'Recusado',   color: '#C0553F', bg: '#F6E4DE' },
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default function ConvidadosPage() {
  const [filter, setFilter] = useState<Filter>('todos')

  const visible = GUESTS.filter((g) => filter === 'todos' || g.status === filter)

  const FILTER_OPTS: { key: Filter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'confirmado', label: 'Confirmados' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'recusado', label: 'Recusados' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Convidados
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Gerencie sua lista de convidados e confirmações
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'transparent', color: 'var(--wedding-color)',
              border: '1.5px solid var(--wedding-color)', borderRadius: '12px',
              padding: '10px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            <UploadIcon /> Importar CSV
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 16px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
            }}
          >
            <PlusIcon /> Convidado
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
        {[
          { label: 'Total', value: STATS.total, color: 'var(--fg)' },
          { label: 'Confirmados', value: STATS.confirmado, color: '#5E8B6A' },
          { label: 'Pendentes', value: STATS.pendente, color: 'var(--wedding-color-dark)' },
          { label: 'Recusados', value: STATS.recusado, color: '#C0553F' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-[var(--surface)] p-5"
            style={{ boxShadow: '0 6px 18px rgba(60,40,24,0.07)', textAlign: 'center' }}
          >
            <div className="font-display" style={{ fontSize: '38px', fontWeight: 600, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '4px', fontWeight: 500 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_OPTS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '7px 16px', borderRadius: '99px', fontSize: '13.5px',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f.key ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
              color: filter === f.key ? '#fff' : '#9A7A60',
              transition: 'all 0.18s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Guest list */}
      <div className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {visible.map((guest, idx) => {
          const st = STATUS_STYLE[guest.status]
          const initial = guest.name.charAt(0).toUpperCase()
          return (
            <div
              key={idx}
              className="flex items-center gap-4 px-5 py-4"
              style={{ borderBottom: idx < visible.length - 1 ? '1px solid #F8F3EE' : 'none' }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--wedding-color) 14%, transparent)', color: 'var(--wedding-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '16px',
                }}
              >
                {initial}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>
                  {guest.name}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
                  {guest.group}
                </div>
              </div>
              {/* Badge */}
              <span
                style={{
                  fontSize: '12px', fontWeight: 600, padding: '4px 11px',
                  borderRadius: '99px', background: st.bg, color: st.color, flexShrink: 0,
                }}
              >
                {st.label}
              </span>
            </div>
          )
        })}
        {visible.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            Nenhum convidado encontrado para este filtro.
          </div>
        )}
      </div>
    </div>
  )
}
