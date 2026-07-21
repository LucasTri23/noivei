'use client'

import { useEffect, useRef, useState } from 'react'

interface DatePickerProps {
  id?:          string
  value:        string // 'YYYY-MM-DD' ou ''
  onChange:     (value: string) => void
  placeholder?: string
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function parseIso(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

const triggerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', background: 'var(--surface)', color: 'var(--fg)',
  outline: 'none', width: '100%', cursor: 'pointer', textAlign: 'left',
}

const navBtnStyle: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '8px', border: 'none',
  background: 'transparent', color: 'var(--muted-fg)', fontSize: '18px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export default function DatePicker({ id, value, onChange, placeholder }: DatePickerProps) {
  const selected = parseIso(value)
  const [open, setOpen]         = useState(false)
  const [viewDate, setViewDate] = useState(() => selected ?? new Date())
  const [alignRight, setAlignRight] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const POPOVER_WIDTH = 272

  function toggleOpen() {
    if (!open) {
      setViewDate(selected ?? new Date())
      const rect = wrapRef.current?.getBoundingClientRect()
      if (rect) setAlignRight(rect.left + POPOVER_WIDTH > window.innerWidth - 16)
    }
    setOpen((o) => !o)
  }

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button" id={id} onClick={toggleOpen} style={triggerStyle}>
        <span style={{ color: selected ? 'var(--fg)' : '#B8A48E' }}>
          {selected
            ? selected.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            : (placeholder ?? 'Selecione a data')}
        </span>
        <span style={{ color: 'var(--muted-fg)' }}><CalendarIcon /></span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', zIndex: 20,
            left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto',
            background: 'var(--surface)', borderRadius: '16px',
            width: `${POPOVER_WIDTH}px`, maxWidth: 'calc(100vw - 24px)',
            border: '1px solid #EBDDD0', boxShadow: '0 16px 40px rgba(60,40,24,0.18)', padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button type="button" aria-label="Mês anterior" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={navBtnStyle}>‹</button>
            <span className="font-display" style={{ fontWeight: 600, fontSize: '15px', color: 'var(--fg)' }}>
              {MONTHS[month]} {year}
            </span>
            <button type="button" aria-label="Próximo mês" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={navBtnStyle}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--muted-fg)', padding: '4px 0' }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((date, idx) => {
              if (!date) return <div key={idx} />
              const isSelected = selected != null && isSameDay(date, selected)
              const isToday    = isSameDay(date, today)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { onChange(toIso(date)); setOpen(false) }}
                  style={{
                    aspectRatio: '1', borderRadius: '10px',
                    border: isToday && !isSelected ? '1.5px solid var(--wedding-color)' : 'none',
                    background: isSelected ? 'var(--wedding-color)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--fg)',
                    fontSize: '13px', fontWeight: isSelected ? 700 : 500, cursor: 'pointer',
                  }}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
