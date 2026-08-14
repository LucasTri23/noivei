'use client'

import { buildVendorWhatsAppUrl } from '@/lib/vendor/build-vendor-whatsapp-link'
import { toastSuccess } from '@/store/toast.store'

interface VendorContactActionsProps {
  businessName: string
  whatsapp:     string | null
  showWhatsapp: boolean
}

function WhatsAppIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.06h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.16 8.16 0 0 1-1.26-4.3c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.83 2.41a8.17 8.17 0 0 1 2.41 5.82c0 4.53-3.7 8.24-8.24 8.24Zm4.51-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.41 1.02 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// Chat de verdade (vendor_conversations) é a Fase 4 do marketplace, fora de escopo
// desta fase — de propósito NÃO cria nenhuma linha em conversation nenhuma aqui,
// só avisa que a funcionalidade está a caminho. WhatsApp continua sendo o único
// canal de contato direto até lá.
export default function VendorContactActions({ businessName, whatsapp, showWhatsapp }: VendorContactActionsProps) {
  const canWhatsApp = showWhatsapp && Boolean(whatsapp)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {canWhatsApp && (
        <a
          href={buildVendorWhatsAppUrl({ businessName, whatsapp: whatsapp as string })}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: '#25D366', color: '#fff', textDecoration: 'none',
            borderRadius: 'var(--radius-lg)', padding: '13px', fontWeight: 700, fontSize: '14px',
          }}
        >
          <WhatsAppIcon />
          Chamar no WhatsApp
        </a>
      )}

      <button
        type="button"
        onClick={() => toastSuccess('Chat chega em breve! Por enquanto, use o WhatsApp para conversar.')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
          border: 'none', borderRadius: 'var(--radius-lg)', padding: '13px', fontWeight: 700, fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        <ChatIcon />
        Conversar pelo Wednest
      </button>
    </div>
  )
}
