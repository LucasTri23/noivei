import Link from 'next/link'

interface VendorTopBarProps {
  businessName:            string | null
  // Ponto (não contagem), mesmo critério do badge do lado do casal (sidebar.tsx) —
  // a contagem por conversa já aparece na lista.
  hasUnreadVendorMessages: boolean
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// Cabeçalho enxuto da área do PRÓPRIO fornecedor — não é a sidebar/nav completa do
// app do casal (Sidebar/MobileTopBar), que carrega tema de wedding-color e módulos
// do casamento, nenhum dos dois fazendo sentido aqui. "Perfil" e "Assinatura"
// (Fase 6) completam a navegação ao lado de "Mensagens" (Fase 4).
export default function VendorTopBar({ businessName, hasUnreadVendorMessages }: VendorTopBarProps) {
  return (
    <header
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '12px',
        padding:        '16px clamp(20px, 4vw, 44px)',
        borderBottom:   '1px solid color-mix(in srgb, var(--wedding-color) 14%, transparent)',
        background:     'var(--surface)',
      }}
    >
      <Link href="/fornecedor" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <span className="font-display" style={{ fontSize: '19px', fontWeight: 500, color: 'var(--wedding-color-dark)' }}>
          Wednest
        </span>
        <span
          style={{
            fontSize:       '11px',
            fontWeight:     700,
            letterSpacing:  '0.06em',
            textTransform:  'uppercase',
            color:          'var(--wedding-color-dark)',
            background:     'var(--wedding-color-subtle)',
            padding:        '3px 9px',
            borderRadius:   '999px',
          }}
        >
          Fornecedor
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <Link
          href="/fornecedor/perfil"
          style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--wedding-color-dark)', textDecoration: 'none' }}
        >
          Perfil
        </Link>

        <Link
          href="/fornecedor/assinatura"
          style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--wedding-color-dark)', textDecoration: 'none' }}
        >
          Assinatura
        </Link>

        <Link
          href="/fornecedor/conversas"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            fontSize: '13.5px', fontWeight: 600, color: 'var(--wedding-color-dark)', textDecoration: 'none',
          }}
        >
          <ChatIcon />
          Mensagens
          {hasUnreadVendorMessages && (
            <span
              aria-label="Mensagens não lidas"
              style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: 'var(--wedding-color)', flexShrink: 0,
              }}
            />
          )}
        </Link>

        {businessName && (
          <span style={{ fontSize: '13.5px', color: 'var(--muted-fg)', fontWeight: 600, textAlign: 'right' }}>
            {businessName}
          </span>
        )}
      </div>
    </header>
  )
}
