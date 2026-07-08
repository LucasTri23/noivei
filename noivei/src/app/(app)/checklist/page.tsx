'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { CHECKLIST_CATEGORIES } from '@/lib/checklist/catalog'
import type { ChecklistItem } from '@/types/database'

type Filter = 'todas' | 'pendentes' | 'concluidas'

const FILTER_LABELS: Record<Filter, string> = {
  todas:      'Todas',
  pendentes:  'Pendentes',
  concluidas: 'Concluídas',
}

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

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ChecklistPage() {
  const [filter, setFilter]   = useState<Filter>('todas')
  const [loading, setLoading] = useState(true)
  const [items, setItems]     = useState<ChecklistItem[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowser()

    async function load() {
      const { data: wedding } = await supabase
        .from('weddings')
        .select('id')
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!wedding) {
        if (!cancelled) setLoading(false)
        return
      }

      const { data } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('wedding_id', wedding.id)
        .eq('is_archived', false)
        .eq('is_dismissed', false)
        .order('sort_order')

      if (!cancelled) {
        setItems((data ?? []) as ChecklistItem[])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const total = items.length
  const done  = items.filter((i) => i.completed).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // Agrupa por categoria na ordem do catálogo; categorias fora do catálogo (tarefas avulsas) vão para o fim
  const groups = useMemo(() => {
    const known = CHECKLIST_CATEGORIES.filter((cat) => items.some((i) => i.category === cat))
    const extra = [...new Set(items.map((i) => i.category ?? 'Outras tarefas'))]
      .filter((cat) => !(CHECKLIST_CATEGORIES as readonly string[]).includes(cat))
    return [...known, ...extra].map((cat) => ({
      title: cat,
      items: items.filter((i) => (i.category ?? 'Outras tarefas') === cat),
    }))
  }, [items])

  async function toggle(item: ChecklistItem) {
    const completed = !item.completed
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed } : i)))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').update({ completed }).eq('id', item.id)
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !completed } : i)))
    }
  }

  async function dismiss(item: ChecklistItem) {
    const previous = items
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').update({ is_dismissed: true }).eq('id', item.id)
    if (error) setItems(previous)
  }

  function filterItem(item: ChecklistItem) {
    if (filter === 'pendentes') return !item.completed
    if (filter === 'concluidas') return item.completed
    return true
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Checklist
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            {done} de {total} tarefas concluídas
          </p>
        </div>
        {/* TODO Sprint 2: criação de tarefa avulsa (sem catalog_key) */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Adicionar tarefa
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-2xl bg-[var(--surface)] p-5" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.07)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)' }}>Progresso geral</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color)' }}>{pct}%</span>
        </div>
        <div style={{ height: '10px', borderRadius: '99px', background: '#EBDDD0', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '99px',
              background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color-dark))',
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
              background: filter === f ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
              color: filter === f ? '#fff' : '#9A7A60',
              transition: 'all 0.18s',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-5">
        {loading && (
          <div
            className="rounded-2xl bg-[var(--surface)] p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
          >
            Carregando seu checklist…
          </div>
        )}
        {!loading && groups.length === 0 && (
          <div
            className="rounded-2xl bg-[var(--surface)] p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
          >
            Nenhuma tarefa ainda. Complete o onboarding para gerar o checklist personalizado do casal.
          </div>
        )}
        {groups.map((group) => {
          const visible = group.items.filter(filterItem)
          if (visible.length === 0) return null
          const groupDone = group.items.filter((i) => i.completed).length
          return (
            <div key={group.title} className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3EAE0' }}>
                <span className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)' }}>
                  {group.title}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600, padding: '3px 10px',
                  borderRadius: '99px', background: '#F1E6D4', color: 'var(--wedding-color-dark)',
                }}>
                  {groupDone}/{group.items.length}
                </span>
              </div>
              <div>
                {visible.map((item, idx) => {
                  const isDone = item.completed
                  const due = formatDue(item.due_date)
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-4 px-5 py-4 cursor-pointer"
                      style={{
                        borderBottom: idx < visible.length - 1 ? '1px solid #F8F3EE' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => toggle(item)}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '22px', height: '22px', borderRadius: '6px',
                          border: isDone ? 'none' : '2px solid #D8C6A6',
                          background: isDone ? 'var(--wedding-color)' : 'transparent',
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
                      {/* Não se aplica */}
                      {!isDone && (
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(item) }}
                          title="Marcar como não se aplica"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: '12px', color: 'var(--muted-fg)', padding: '2px 6px',
                            flexShrink: 0, textDecoration: 'underline',
                          }}
                        >
                          não se aplica
                        </button>
                      )}
                      {/* Due */}
                      {due && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--muted-fg)', flexShrink: 0 }}>
                          <ClockIcon />
                          <span style={{ fontSize: '12.5px' }}>{due}</span>
                        </div>
                      )}
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
