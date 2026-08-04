'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  open:      boolean
  onClose:   () => void
  title?:    string
  maxWidth?: string
  children:  React.ReactNode
}

// Mesma lista simples usada pro trap de foco: cobre tudo que este app usa dentro de
// modais hoje (botões, links, inputs, selects, textareas e elementos com tabindex
// explícito). Elementos desabilitados são filtrados à parte, não dá pra excluir via
// seletor CSS puro sem `:not([disabled])` ficar ilegível ao lado do resto.
const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled'),
  )
}

export default function Modal({ open, onClose, title, maxWidth = '440px', children }: ModalProps) {
  const containerRef         = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<Element | null>(null)

  // Ao abrir: guarda quem tinha foco (pra devolver depois) e move o foco pro
  // primeiro elemento focável de dentro do modal (cai pro próprio container, com
  // tabIndex={-1}, se não houver nenhum). Ao fechar ou desmontar: devolve o foco a
  // quem abriu o modal, se esse elemento ainda existir no DOM.
  useEffect(() => {
    if (!open) return undefined

    previouslyFocusedRef.current = document.activeElement
    const container = containerRef.current
    if (container) {
      const [first] = getFocusableElements(container)
      ;(first ?? container).focus()
    }

    return () => {
      const target = previouslyFocusedRef.current
      if (target instanceof HTMLElement && document.contains(target)) {
        target.focus()
      }
      previouslyFocusedRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return
      const focusable = getFocusableElements(container)
      const first     = focusable[0]
      const last      = focusable[focusable.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }

      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)

      if (e.shiftKey) {
        if (activeIndex <= 0) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeIndex === -1 || activeIndex === focusable.length - 1) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(42,30,16,0.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-white"
        style={{
          width: '100%', maxWidth, padding: '26px',
          boxShadow: '0 24px 60px rgba(42,30,16,0.28)',
          maxHeight: '90vh', overflowY: 'auto',
          outline: 'none',
        }}
      >
        {title && (
          <h2 className="font-display" style={{ fontSize: '22px', fontWeight: 500, color: '#3C2818', margin: '0 0 14px' }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
