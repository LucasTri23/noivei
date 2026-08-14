import Link from 'next/link'

interface VendorTopBarProps {
  businessName: string | null
}

// Cabeçalho enxuto da área do PRÓPRIO fornecedor — não é a sidebar/nav completa do
// app do casal (Sidebar/MobileTopBar), que carrega tema de wedding-color e módulos
// do casamento, nenhum dos dois fazendo sentido aqui. A navegação completa deste
// grupo (mensagens, assinatura, portfólio editável) é escopo da Fase 6 — por
// enquanto só precisa hospedar o wizard de cadastro e a página de status.
export default function VendorTopBar({ businessName }: VendorTopBarProps) {
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

      {businessName && (
        <span style={{ fontSize: '13.5px', color: 'var(--muted-fg)', fontWeight: 600, textAlign: 'right' }}>
          {businessName}
        </span>
      )}
    </header>
  )
}
