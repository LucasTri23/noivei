'use client'

/* eslint-disable @next/next/no-img-element -- QR code gerado como data URL no navegador */
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import Modal from '@/components/ui/modal'
import { CheckIcon, CopyIcon, DownloadIcon, ShareIcon, WhatsAppIcon } from '@/components/site/editor/icons'
import { ghostButtonStyle, hintStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '@/components/site/editor/styles'
import { toastError } from '@/store/toast.store'

interface ShareDialogProps {
  open:        boolean
  onClose:     () => void
  url:         string
  coupleNames: string
  slug:        string
}

/** Tudo o que o casal precisa para mandar o site aos convidados: link, WhatsApp e QR code. */
export default function ShareDialog({ open, onClose, url, coupleNames, slug }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const message = `Oi! Preparamos um site com todos os detalhes do nosso casamento 💍\n${url}\n\nCom carinho, ${coupleNames}`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    QRCode.toDataURL(url, { width: 640, margin: 2 })
      .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl) })
      .catch(() => { if (!cancelled) setQrDataUrl(null) })
    return () => { cancelled = true }
  }, [open, url])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toastError('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: `Casamento de ${coupleNames}`, text: message, url })
    } catch {
      // Cancelado pelo usuário — nada a fazer.
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar o site" maxWidth="460px">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="site-share-url" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px' }}>Link do site</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input id="site-share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ ...inputStyle, fontSize: '14px' }} />
            <button type="button" onClick={copyLink} style={{ ...primaryButtonStyle, flexShrink: 0, padding: '0 16px' }} aria-live="polite">
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...secondaryButtonStyle, flex: '1 1 160px', background: '#E7F6EC', color: '#1E7A43' }}
          >
            <WhatsAppIcon /> Enviar no WhatsApp
          </a>
          {canNativeShare && (
            <button type="button" onClick={nativeShare} style={{ ...ghostButtonStyle, flex: '1 1 140px', minHeight: '42px', fontSize: '14px', fontWeight: 600 }}>
              <ShareIcon /> Mais opções
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '14px', background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div style={{ width: '112px', height: '112px', flexShrink: 0, borderRadius: '10px', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {qrDataUrl
              ? <img src={qrDataUrl} alt={`QR code do site ${url}`} width={112} height={112} />
              : <span style={{ fontSize: '12px', color: '#9A7A60' }}>Gerando…</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>QR code</p>
            <p style={{ ...hintStyle, margin: '2px 0 10px' }}>Para o convite impresso, o save the date ou a mesa de recepção.</p>
            {qrDataUrl && (
              <a href={qrDataUrl} download={`qr-site-${slug}.png`} style={{ ...ghostButtonStyle, display: 'inline-flex', fontWeight: 600, textDecoration: 'none' }}>
                <DownloadIcon /> Baixar PNG
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
