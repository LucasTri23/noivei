'use client'

import { useState } from 'react'

type Filter = 'todas' | 'pendentes' | 'concluidas'

interface ChecklistItem {
  id: string
  label: string
  due: string
  defaultDone: boolean
}

interface Group {
  title: string
  items: ChecklistItem[]
}

// Sem dados padrão ainda — cada casal começa com a checklist vazia até definirmos o template
const GROUPS: Group[] = []

const ALL_ITEMS = GROUPS.flatMap((g) => g.items)

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

export default function ChecklistPage() {
  const [filter, setFilter] = useState<Filter>('todas')
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i.defaultDone]))
  )

  const total = ALL_ITEMS.length
  const done = ALL_ITEMS.filter((i) => checks[i.id]).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  function toggle(id: string) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function filterItem(item: ChecklistItem) {
    if (filter === 'pendentes') return !checks[item.id]
    if (filter === 'concluidas') return checks[item.id]
    return true
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
          >
            Checklist
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', marginTop: '4px' }}>
            {done} de {total} tarefas concluídas
          </p>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#C6943A', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(198,148,58,0.32)',
          }}
        >
          <PlusIcon /> Adicionar tarefa
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-2xl bg-white p-5" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.07)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818' }}>Progresso geral</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#C6943A' }}>{pct}%</span>
        </div>
        <div style={{ height: '10px', borderRadius: '99px', background: '#EBDDD0', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '99px',
              background: 'linear-gradient(90deg, #E0B870, #9A7020)',
              width: `${pct}%`, transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-6 flex gap-2">
        {(['todas', 'pendentes', 'concluidas'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: '99px', fontSize: '13.5px',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f ? '#C6943A' : '#FBF5EE',
              color: filter === f ? '#fff' : '#9A7A60',
              transition: 'all 0.18s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-5">
        {GROUPS.length === 0 && (
          <div
            className="rounded-2xl bg-white p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: '#9A7A60', fontSize: '14px' }}
          >
            Nenhuma tarefa ainda. Adicione a primeira tarefa acima.
          </div>
        )}
        {GROUPS.map((group) => {
          const visible = group.items.filter(filterItem)
          if (visible.length === 0) return null
          const groupDone = group.items.filter((i) => checks[i.id]).length
          return (
            <div key={group.title} className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3EAE0' }}>
                <span className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: '#3C2818' }}>
                  {group.title}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600, padding: '3px 10px',
                  borderRadius: '99px', background: '#F1E6D4', color: '#9A7020',
                }}>
                  {groupDone}/{group.items.length}
                </span>
              </div>
              <div>
                {visible.map((item, idx) => {
                  const isDone = checks[item.id]
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                      style={{
                        borderBottom: idx < visible.length - 1 ? '1px solid #F8F3EE' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => toggle(item.id)}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '22px', height: '22px', borderRadius: '6px',
                          border: isDone ? 'none' : '2px solid #D8C6A6',
                          background: isDone ? '#C6943A' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.18s',
                        }}
                      >
                        {isDone && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      {/* Label */}
                      <span style={{
                        flex: 1, fontSize: '14.5px', fontWeight: 500,
                        color: isDone ? '#9A7A60' : '#3C2818',
                        textDecoration: isDone ? 'line-through' : 'none',
                        transition: 'all 0.18s',
                      }}>
                        {item.label}
                      </span>
                      {/* Due */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9A7A60', flexShrink: 0 }}>
                        <ClockIcon />
                        <span style={{ fontSize: '12.5px' }}>{item.due}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
