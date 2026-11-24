'use client'

import { CameraIcon, CheckIcon, GiftIcon, HeartIcon, ImageIcon, MailCheckIcon, MapPinIcon } from '@/components/site/editor/icons'
import { labelStyle, inputStyle } from '@/components/site/editor/styles'
import type { EditorSectionId } from '@/lib/site/site-draft'

export const EDITOR_SECTIONS: { id: EditorSectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'capa',      label: 'Capa',              icon: <ImageIcon /> },
  { id: 'historia',  label: 'Nossa história',    icon: <HeartIcon /> },
  { id: 'cerimonia', label: 'Cerimônia & festa', icon: <MapPinIcon /> },
  { id: 'rsvp',      label: 'Confirmar presença', icon: <MailCheckIcon /> },
  { id: 'presentes', label: 'Lista de presentes', icon: <GiftIcon /> },
  { id: 'galeria',   label: 'Galeria',           icon: <CameraIcon /> },
]

export type SectionStatus = 'dirty' | 'filled' | 'empty'

const STATUS_TEXT: Record<SectionStatus, string> = {
  dirty:  'alterações não salvas',
  filled: 'preenchida',
  empty:  'vazia',
}

export function sectionTabId(id: EditorSectionId): string {
  return `site-tab-${id}`
}

export function sectionPanelId(id: EditorSectionId): string {
  return `site-panel-${id}`
}

function StatusMark({ status }: { status: SectionStatus }) {
  if (status === 'dirty') {
    return <span aria-hidden title="Alterações não salvas" style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--wedding-color)', flexShrink: 0 }} />
  }
  if (status === 'filled') {
    return (
      <span aria-hidden title="Preenchida" style={{ display: 'grid', placeItems: 'center', width: '18px', height: '18px', borderRadius: '50%', background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)', flexShrink: 0 }}>
        <CheckIcon size={11} />
      </span>
    )
  }
  return <span aria-hidden title="Vazia" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px dashed var(--muted-fg)', opacity: 0.6, flexShrink: 0 }} />
}

interface SectionNavProps {
  active:   EditorSectionId
  statuses: Record<EditorSectionId, SectionStatus>
  onSelect: (id: EditorSectionId) => void
}

/** Navegação entre as seções: lista com status no computador e select no celular/tablet. */
export default function SectionNav({ active, statuses, onSelect }: SectionNavProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const index = EDITOR_SECTIONS.findIndex((section) => section.id === active)
    let next: number | null = null
    if (e.key === 'ArrowDown') next = (index + 1) % EDITOR_SECTIONS.length
    if (e.key === 'ArrowUp') next = (index - 1 + EDITOR_SECTIONS.length) % EDITOR_SECTIONS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = EDITOR_SECTIONS.length - 1
    if (next === null) return
    e.preventDefault()
    const section = EDITOR_SECTIONS[next]
    if (!section) return
    onSelect(section.id)
    document.getElementById(sectionTabId(section.id))?.focus()
  }

  return (
    <>
      {/* Celular e tablet em pé: select nativo — uma linha só em vez de 6 botões empilhados,
          e sem roubar largura do editor ao lado da barra lateral do app. */}
      <div className="lg:hidden">
        <label htmlFor="site-section-select" style={labelStyle}>Seção do site</label>
        <select
          id="site-section-select"
          value={active}
          onChange={(e) => onSelect(e.target.value as EditorSectionId)}
          style={{ ...inputStyle, fontWeight: 600, appearance: 'auto' }}
        >
          {EDITOR_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}{statuses[section.id] === 'dirty' ? ' • não salvo' : statuses[section.id] === 'filled' ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      <div
        role="tablist"
        aria-label="Seções do site"
        aria-orientation="vertical"
        onKeyDown={handleKeyDown}
        className="hidden lg:flex lg:flex-col lg:gap-2"
      >
        {EDITOR_SECTIONS.map((section) => {
          const isActive = active === section.id
          const status = statuses[section.id]
          return (
            <button
              key={section.id}
              id={sectionTabId(section.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={sectionPanelId(section.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(section.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '13px 16px', borderRadius: '14px',
                border: isActive ? '1.5px solid color-mix(in srgb, var(--wedding-color) 35%, transparent)' : '1px solid transparent',
                background: isActive ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                color: isActive ? 'var(--wedding-color-dark)' : 'var(--fg)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                boxShadow: isActive ? '0 4px 12px color-mix(in srgb, var(--wedding-color) 12%, transparent)' : '0 2px 8px rgba(60,40,24,0.05)',
                transition: 'background 0.18s, border-color 0.18s',
              }}
            >
              <span aria-hidden style={{ display: 'flex', color: isActive ? 'var(--wedding-color)' : 'var(--muted-fg)' }}>{section.icon}</span>
              <span style={{ flex: 1 }}>{section.label}</span>
              <StatusMark status={status} />
              <span className="sr-only">({STATUS_TEXT[status]})</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
