'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './premium-site.module.css'

export interface FoldPanel {
  id:      string
  label:   string
  content: React.ReactNode
}

const SWIPE_MIN_PX = 60

/**
 * Convite do estilo Envelopado depois de aberto: painéis lado a lado, presos uns
 * aos outros como uma sanfona de papel. Cada avanço desdobra o próximo painel
 * (gira na dobra, de lado) e o anterior continua visível na borda — tocá-lo volta.
 * Conteúdo maior que a tela rola dentro do próprio painel.
 */
export default function FoldedInvitation({ panels, className }: { panels: FoldPanel[]; className: string }) {
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollers = useRef<(HTMLDivElement | null)[]>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const total = panels.length

  function go(next: number) {
    const clamped = Math.max(0, Math.min(total - 1, next))
    if (clamped === index) return
    moved.current = true
    indexRef.current = clamped
    setIndex(clamped)
  }

  // Leva o foco para o painel recém-aberto (leitor de tela e teclado acompanham a dobra).
  useEffect(() => {
    if (!moved.current) return
    const scroller = scrollers.current[index]
    scroller?.focus({ preventScroll: true })
  }, [index])

  // Setas ← → em qualquer lugar da página (o foco, ao abrir o envelope, fica no
  // contêiner de fora). Ignora enquanto o convite está fechado e dentro de campos.
  const goRef = useRef(go)
  useEffect(() => { goRef.current = go })
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (!rootRef.current || rootRef.current.closest('[hidden]')) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      goRef.current(event.key === 'ArrowRight' ? indexRef.current + 1 : indexRef.current - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Links internos (#celebracao, #historia…) levam à dobra que contém a seção.
  function handleClick(event: React.MouseEvent) {
    const link = (event.target as HTMLElement).closest('a[href^="#"]')
    if (!link) return
    const id = link.getAttribute('href')?.slice(1)
    if (!id) return
    const target = panels.findIndex((panel, i) => panel.id === id || Boolean(scrollers.current[i]?.querySelector(`#${CSS.escape(id)}`)))
    if (target === -1) return
    event.preventDefault()
    go(target)
  }

  function handleTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0]
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Só gesto claramente horizontal — o vertical é a rolagem dentro do painel.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    go(dx < 0 ? index + 1 : index - 1)
  }

  const current = panels[index]

  return (
    <div ref={rootRef} className={className} onClick={handleClick} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={styles.foldStage}>
        <div className={styles.foldTrack} style={{ '--fold-index': index } as React.CSSProperties}>
          {panels.map((panel, i) => {
            const state = i < index ? 'before' : i === index ? 'active' : 'folded'
            return (
              <div
                key={panel.id}
                role="group"
                aria-roledescription="dobra do convite"
                aria-label={`${i + 1} de ${total}: ${panel.label}`}
                aria-hidden={state === 'folded' || undefined}
                className={styles.foldPanel}
                data-state={state}
              >
                <div
                  ref={(element) => { scrollers.current[i] = element }}
                  className={styles.foldScroller}
                  tabIndex={-1}
                  inert={state !== 'active'}
                >
                  {panel.content}
                </div>
                {state === 'before' && (
                  <button type="button" className={styles.foldBack} onClick={() => go(i)} aria-label={`Voltar para ${panel.label}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <nav className={styles.foldControls} aria-label="Navegar pelo convite">
        <button type="button" className={styles.foldButton} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Dobra anterior">‹</button>
        <div className={styles.foldStatus}>
          <p aria-live="polite">{current?.label}</p>
          <span className={styles.foldDots} aria-hidden="true">
            {panels.map((panel, i) => <span key={panel.id} data-active={i === index || undefined} />)}
          </span>
          <span className="sr-only">{`Dobra ${index + 1} de ${total}`}</span>
        </div>
        <button type="button" className={styles.foldButton} onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Desdobrar o próximo painel">›</button>
      </nav>
    </div>
  )
}
