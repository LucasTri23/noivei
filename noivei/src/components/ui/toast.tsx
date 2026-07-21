'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToastStore, type ToastItem } from '@/store/toast.store'

const AUTO_DISMISS_MS = 4000
const EXIT_DURATION_MS = 200

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleClose = useCallback(() => {
    setLeaving(true)
    setTimeout(() => dismiss(toast.id), EXIT_DURATION_MS)
  }, [dismiss, toast.id])

  useEffect(() => {
    const timer = setTimeout(handleClose, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [handleClose])

  const isSuccess = toast.type === 'success'
  const tone = isSuccess ? 'var(--color-success)' : 'var(--color-error)'

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className="w-full md:w-auto md:max-w-[380px]"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '14px 16px', borderRadius: '14px',
        background: 'var(--surface)', boxShadow: 'var(--shadow-xl)',
        border: `1px solid color-mix(in srgb, ${tone} 28%, transparent)`,
        opacity: entered && !leaving ? 1 : 0,
        transform: entered && !leaving ? 'translateY(0)' : 'translateY(-8px)',
        transition: `opacity var(--duration-base) var(--ease-default), transform var(--duration-base) var(--ease-default)`,
      }}
    >
      <span
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: '26px', height: '26px', borderRadius: '50%',
          background: `color-mix(in srgb, ${tone} 16%, transparent)`,
          color: tone,
        }}
      >
        {isSuccess ? <CheckIcon /> : <ErrorIcon />}
      </span>
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--fg)', lineHeight: 1.5, paddingTop: '3px', wordBreak: 'break-word' }}>
        {toast.message}
      </span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar notificação"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: '22px', height: '22px', border: 'none', background: 'transparent',
          color: 'var(--muted-fg)', cursor: 'pointer', padding: 0, borderRadius: '8px',
        }}
      >
        <CloseIcon />
      </button>
    </div>
  )
}

// Topo-direita no desktop; no mobile fica no topo, largura quase cheia (não no
// bottom, que colide com a MobileBottomNav fixa em todas as páginas autenticadas).
export default function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed inset-x-4 top-4 flex flex-col items-stretch gap-2.5 md:inset-x-auto md:top-5 md:right-5 md:items-end"
      style={{ zIndex: 'var(--z-toast)', pointerEvents: 'none' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard toast={toast} />
        </div>
      ))}
    </div>
  )
}
