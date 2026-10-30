'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './premium-site.module.css'

export default function InvitationEnvelope({ names, date, initials, children, caption, openingHint }: {
  caption?: string; openingHint?: string; names: string; date: string | null; initials: string; children: React.ReactNode
}) {
  const [opened, setOpened] = useState(false)
  const [finished, setFinished] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (finished) contentRef.current?.focus({ preventScroll: true })
  }, [finished])

  // Fallback caso a animação seja interrompida ou o navegador não emita animationend.
  useEffect(() => {
    if (!opened || finished) return
    const timeout = setTimeout(() => setFinished(true), 1900)
    return () => clearTimeout(timeout)
  }, [opened, finished])

  function open() {
    setOpened(true)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setFinished(true)
  }

  return (
    <div className={styles.envelopeRoot}>
      {!finished && (
        <div className={`${styles.gate} ${opened ? styles.gateOpening : ''}`} onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && opened) setFinished(true)
        }} aria-hidden={opened || undefined}>
          <div className={styles.gateIntro}><span>UM CONVITE ESPECIAL</span><p>{names}</p></div>
          <div className={styles.envelope}>
            <div className={styles.envelopeLiner} aria-hidden="true"><span>{initials}</span><p>{date || 'O nosso grande dia'}</p></div>
            <div className={`${styles.flap} ${styles.flapLeft}`} aria-hidden="true" />
            <div className={`${styles.flap} ${styles.flapRight}`} aria-hidden="true" />
            <div className={styles.goldCord} aria-hidden="true" />
            <button type="button" className={styles.seal} onClick={open} disabled={opened} aria-label="Abrir convite de casamento" aria-controls="invitation-content" aria-expanded={opened}>
              <span className={styles.sealInner}>{initials}</span>
            </button>
            <span className={styles.envelopeCaption} aria-hidden="true">{caption || 'COM CARINHO, PARA VOCÊ'}</span>
          </div>
          <p className={styles.openHint}>{opened ? 'Abrindo o seu convite…' : (openingHint || 'Toque no selo dourado para abrir')}</p>
        </div>
      )}
      <div id="invitation-content" hidden={!opened} ref={contentRef} tabIndex={-1} aria-label={`Site de casamento de ${names}`}>
        {children}
      </div>
    </div>
  )
}