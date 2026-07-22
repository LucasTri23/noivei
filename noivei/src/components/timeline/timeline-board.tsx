'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { TIMELINE_PHASES } from '@/lib/checklist/catalog'
import type { ChecklistItem } from '@/types/database'

interface TimelineBoardProps {
  items: ChecklistItem[]
  weddingId: string | null
}

interface TimelineCard {
  id: string
  title: string
  note: string
  done: boolean
  highlight: boolean
}

interface TimelineGroup {
  phase: string
  window: string
  items: TimelineCard[]
}

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TimelineBoard({ items: initialItems }: TimelineBoardProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)

  // Mesma lista do Checklist, agrupada pela fase (§5 do doc); fases vazias somem.
  // Dentro da fase: por due_date (offset) e depois pela ordem do catálogo (categoria).
  const groups: TimelineGroup[] = useMemo(() => TIMELINE_PHASES.map((phase) => {
    const phaseItems = items
      .filter((item) => item.phase === phase.id)
      .sort((a, b) => {
        if (a.due_date && b.due_date && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date)
        }
        if (a.due_date && !b.due_date) return -1
        if (!a.due_date && b.due_date) return 1
        return a.sort_order - b.sort_order
      })
      .map((item) => ({
        id: item.id,
        title: item.label,
        note: [item.category, formatDue(item.due_date)].filter(Boolean).join(' · ') || 'Sem prazo fixo',
        done: item.completed,
        highlight: phase.id === 'o-grande-dia',
      }))
    return { phase: phase.label, window: phase.window, items: phaseItems }
  }).filter((group) => group.items.length > 0), [items])

  async function toggle(id: string, wasDone: boolean) {
    const completed = !wasDone
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, completed } : i)))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').update({ completed }).eq('id', id)
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, completed: !completed } : i)))
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* A timeline lê os mesmos checklist_items — a ação de gerar mora só no Checklist */}
      {groups.length === 0 && (
        <div
          className="rounded-2xl bg-[var(--surface)] p-10 text-center"
          style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
        >
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 0 16px' }}>
            A timeline nasce das tarefas do seu checklist — e ele ainda não foi gerado.
          </p>
          <Link
            href="/checklist"
            style={{
              display: 'inline-block',
              background: 'var(--wedding-color)', color: '#fff',
              borderRadius: '12px', padding: '12px 28px', fontWeight: 600, fontSize: '14px',
              boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 28%, transparent)',
            }}
          >
            Gerar minha lista no Checklist
          </Link>
        </div>
      )}
      {groups.map((group, gi) => (
        <div key={group.phase} style={{ marginBottom: '40px' }}>
          {/* Phase header */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
            <span
              className="font-display"
              style={{ fontSize: '22px', fontWeight: 500, color: 'var(--wedding-color)', letterSpacing: '0.01em' }}
            >
              {group.phase}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted-fg)' }}>
              {group.window} · {group.items.filter((i) => i.done).length} de {group.items.length} concluídas
            </span>
          </div>

          {/* Items */}
          <div style={{ position: 'relative', paddingLeft: '36px' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: '9px',
                top: '12px',
                bottom: gi < groups.length - 1 ? '-28px' : '12px',
                width: '2px',
                background: '#EBDDD0',
              }}
            />

            {group.items.map((item, ii) => {
              const dotColor = item.highlight
                ? '#C89070'
                : item.done
                ? 'var(--wedding-color)'
                : '#FFFFFF'
              const dotBorder = item.highlight
                ? '#C89070'
                : item.done
                ? 'var(--wedding-color)'
                : '#D8C6A6'

              return (
                <div
                  key={ii}
                  onClick={() => toggle(item.id, item.done)}
                  style={{
                    position: 'relative',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0',
                    cursor: 'pointer',
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-27px',
                      top: '14px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: dotColor,
                      border: `2px solid ${dotBorder}`,
                      boxShadow: item.done || item.highlight ? '0 0 0 3px color-mix(in srgb, var(--wedding-color) 18%, transparent)' : 'none',
                      zIndex: 1,
                    }}
                  >
                    {item.done && (
                      <svg
                        width="10" height="10"
                        viewBox="0 0 24 24" fill="none" stroke="#fff"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ position: 'absolute', top: '2px', left: '2px' }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      background: item.highlight
                        ? 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))'
                        : '#FFFFFF',
                      border: item.highlight ? 'none' : '1px solid #F0E8DE',
                      boxShadow: item.highlight
                        ? '0 12px 28px rgba(60,40,24,0.22)'
                        : '0 4px 14px rgba(60,40,24,0.05)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: item.highlight ? 'var(--wedding-color-light)' : '#3C2818',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: item.highlight ? 'rgba(250,240,230,0.65)' : '#9A7A60',
                        marginTop: '3px',
                      }}
                    >
                      {item.note}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
