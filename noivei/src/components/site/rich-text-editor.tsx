'use client'

import { useRef, useState } from 'react'

import SiteRichText from '@/components/site/site-rich-text'
import { insertLink, toggleInlineFormat, type InlineMarker, type TextSelectionState } from '@/lib/site/rich-text/format-selection'

interface RichTextEditorProps {
  id:           string
  value:        string
  onChange:     (value: string) => void
  /** content.rich_text do site — desligado, é o <textarea> simples de sempre. */
  markdown:     boolean
  maxLength:    number
  rows?:        number
  placeholder?: string
}

const textareaStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
  resize: 'vertical', fontFamily: 'var(--font-body)',
}

const toolButtonStyle: React.CSSProperties = {
  minWidth: '36px', minHeight: '36px', padding: '0 10px', border: '1px solid #EBDDD0', borderRadius: '9px',
  background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer', fontSize: '14px',
}

const TOOLS: { marker: InlineMarker; label: string; shortcut?: string; content: React.ReactNode }[] = [
  { marker: '**', label: 'Negrito', shortcut: 'Ctrl+B', content: <strong>N</strong> },
  { marker: '*',  label: 'Itálico', shortcut: 'Ctrl+I', content: <em style={{ fontFamily: 'Georgia, serif' }}>I</em> },
  { marker: '~~', label: 'Tachado', content: <del>S</del> },
]

/**
 * Editor dos textos personalizáveis do site. Os botões escrevem a marcação por
 * trás — o casal não precisa saber Markdown — e a aba "Visualizar" usa o mesmo
 * SiteRichText do site público.
 */
export default function RichTextEditor({ id, value, onChange, markdown, maxLength, rows = 6, placeholder }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')

  function apply(transform: (state: TextSelectionState) => TextSelectionState) {
    const el = textareaRef.current
    if (!el) return
    const next = transform({ value, start: el.selectionStart, end: el.selectionEnd })
    if (next.value.length > maxLength) return
    onChange(next.value)
    // Restaura a seleção depois do re-render controlado.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.start, next.end)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!markdown || !(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (key === 'b' || key === 'i') {
      e.preventDefault()
      apply((state) => toggleInlineFormat(state, key === 'b' ? '**' : '*'))
    }
  }

  const textarea = (
    <textarea
      ref={textareaRef}
      id={id}
      rows={rows}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={textareaStyle}
    />
  )

  if (!markdown) return textarea

  return (
    <div>
      <div role="toolbar" aria-label="Formatação do texto" aria-controls={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        {TOOLS.map((tool) => (
          <button
            key={tool.marker}
            type="button"
            style={toolButtonStyle}
            disabled={tab === 'preview'}
            onClick={() => apply((state) => toggleInlineFormat(state, tool.marker))}
            aria-label={tool.label}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
          >
            {tool.content}
          </button>
        ))}
        <button type="button" style={toolButtonStyle} disabled={tab === 'preview'} onClick={() => apply(insertLink)} aria-label="Inserir link" title="Inserir link">
          Link
        </button>

        <div role="tablist" aria-label="Modo do editor" style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {(['write', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={tab === mode}
              onClick={() => setTab(mode)}
              style={{
                ...toolButtonStyle,
                background: tab === mode ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                color: tab === mode ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                fontWeight: tab === mode ? 700 : 500, fontSize: '13px',
              }}
            >
              {mode === 'write' ? 'Escrever' : 'Visualizar'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'write' ? textarea : (
        <div
          aria-live="polite"
          style={{ ...textareaStyle, minHeight: `${rows * 1.6}em`, resize: 'none', fontSize: '15px', lineHeight: 1.8, overflowWrap: 'anywhere' }}
        >
          {value.trim()
            ? <SiteRichText text={value} markdown />
            : <span style={{ color: 'var(--muted-fg)' }}>Nada para visualizar ainda.</span>}
        </div>
      )}
    </div>
  )
}
