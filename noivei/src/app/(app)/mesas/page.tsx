'use client'

import { useState, useRef } from 'react'

interface Table {
  id: string
  label: string
  cap: number
  guests: string[]
}

interface State {
  unassigned: string[]
  tables: Table[]
}

// Sem dados padrão ainda — mesas vazias até definirmos o template
const INITIAL: State = {
  unassigned: [],
  tables: [],
}

function GuestChip({ name, draggable = true, onDragStart }: {
  name: string
  draggable?: boolean
  onDragStart?: () => void
}) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '99px',
        background: '#FBF5EE', border: '1px solid #EBDDD0',
        fontSize: '12.5px', fontWeight: 500, color: '#3C2818',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%',
        background: 'rgba(198,148,58,0.18)', color: '#C6943A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700, flexShrink: 0,
      }}>
        {initial}
      </div>
      {name}
    </div>
  )
}

export default function MesasPage() {
  const [state, setState] = useState<State>(INITIAL)
  const dragging = useRef<{ name: string; source: string } | null>(null)

  function handleDragStart(name: string, source: string) {
    dragging.current = { name, source }
  }

  function handleDrop(target: string) {
    if (!dragging.current) return
    const { name, source } = dragging.current
    if (source === target) return

    setState((prev) => {
      const next: State = {
        unassigned: [...prev.unassigned],
        tables: prev.tables.map((t) => ({ ...t, guests: [...t.guests] })),
      }

      // Remove from source
      if (source === 'unassigned') {
        next.unassigned = next.unassigned.filter((g) => g !== name)
      } else {
        const t = next.tables.find((t) => t.id === source)
        if (t) t.guests = t.guests.filter((g) => g !== name)
      }

      // Add to target
      if (target === 'unassigned') {
        next.unassigned.push(name)
      } else {
        const t = next.tables.find((t) => t.id === target)
        if (t && t.guests.length < t.cap) {
          t.guests.push(name)
        } else if (t && t.guests.length >= t.cap) {
          // full — return to source
          if (source === 'unassigned') next.unassigned.push(name)
          else {
            const s = next.tables.find((tb) => tb.id === source)
            if (s) s.guests.push(name)
          }
        }
      }

      return next
    })
    dragging.current = null
  }

  const totalGuests = state.tables.reduce((sum, t) => sum + t.guests.length, 0)
  const totalCap    = state.tables.reduce((sum, t) => sum + t.cap, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
        >
          Organização das mesas
        </h1>
        <p style={{ fontSize: '14px', color: '#9A7A60', marginTop: '4px' }}>
          Arraste os convidados para as mesas · {totalGuests}/{totalCap} lugares preenchidos
        </p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Unassigned */}
        <div>
          <div
            style={{
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: '#9A7A60', marginBottom: '10px',
            }}
          >
            Sem mesa ({state.unassigned.length})
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('unassigned')}
            style={{
              minHeight: '220px', borderRadius: '18px', padding: '14px',
              border: '2px dashed #EBDDD0', background: '#FBF5EE',
              display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start',
            }}
          >
            {state.unassigned.map((name) => (
              <GuestChip
                key={name}
                name={name}
                onDragStart={() => handleDragStart(name, 'unassigned')}
              />
            ))}
            {state.unassigned.length === 0 && (
              <span style={{ fontSize: '13px', color: '#C8B4A0', padding: '8px 4px' }}>
                Todos alocados!
              </span>
            )}
          </div>
        </div>

        {/* Tables grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))' }}>
          {state.tables.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1', borderRadius: '18px', padding: '40px',
                border: '2px dashed #EBDDD0', background: '#FBF5EE',
                textAlign: 'center', color: '#9A7A60', fontSize: '14px',
              }}
            >
              Nenhuma mesa criada ainda.
            </div>
          )}
          {state.tables.map((table) => {
            const full = table.guests.length >= table.cap
            return (
              <div
                key={table.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(table.id)}
                style={{
                  borderRadius: '18px', background: '#FFFFFF',
                  border: `2px dashed ${full ? '#EBDDD0' : '#EBDDD0'}`,
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(60,40,24,0.06)',
                  minHeight: '130px',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F0E8DE',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#3C2818' }}>
                    {table.label}
                  </span>
                  <span
                    style={{
                      fontSize: '12px', fontWeight: 700, padding: '2px 9px',
                      borderRadius: '99px',
                      background: full ? '#F6E4DE' : '#FBF5EE',
                      color: full ? '#C0553F' : '#9A7020',
                    }}
                  >
                    {table.guests.length}/{table.cap}
                  </span>
                </div>

                {/* Guests */}
                <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '64px' }}>
                  {table.guests.map((name) => (
                    <GuestChip
                      key={name}
                      name={name}
                      onDragStart={() => handleDragStart(name, table.id)}
                    />
                  ))}
                  {table.guests.length === 0 && (
                    <span style={{ fontSize: '12.5px', color: '#C8B4A0' }}>
                      Solte aqui
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
