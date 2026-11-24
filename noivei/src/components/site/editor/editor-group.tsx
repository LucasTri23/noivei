'use client'

import { useId, useState } from 'react'

import { ChevronDownIcon } from '@/components/site/editor/icons'

interface EditorGroupProps {
  title:        string
  /** Resumo do que está configurado, visível com o bloco fechado. */
  summary?:     React.ReactNode
  defaultOpen?: boolean
  /** Ponto de "alterações não salvas" no cabeçalho do bloco. */
  dirty?:       boolean
  children:     React.ReactNode
}

/**
 * Bloco recolhível do editor. O conteúdo fechado continua montado (só escondido),
 * para não perder estado local como uploads em andamento.
 */
export default function EditorGroup({ title, summary, defaultOpen = true, dirty = false, children }: EditorGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--surface)' }}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
            padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
              {title}
              {dirty && <span title="Alterações não salvas" aria-label="Alterações não salvas" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--wedding-color)' }} />}
            </span>
            {summary && !open && (
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--muted-fg)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </span>
            )}
          </span>
          <span aria-hidden style={{ display: 'flex', color: 'var(--muted-fg)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <ChevronDownIcon />
          </span>
        </button>
      </h3>
      <div id={contentId} hidden={!open} style={{ padding: '2px 16px 18px' }}>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </section>
  )
}
