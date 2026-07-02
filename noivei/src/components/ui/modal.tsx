'use client'

import { useEffect } from 'react'

interface ModalProps {
  open:     boolean
  onClose:  () => void
  title?:   string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
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
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-white"
        style={{
          width: '100%', maxWidth: '440px', padding: '26px',
          boxShadow: '0 24px 60px rgba(42,30,16,0.28)',
          maxHeight: '90vh', overflowY: 'auto',
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
