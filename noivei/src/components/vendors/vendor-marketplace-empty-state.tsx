import Link from 'next/link'

interface VendorMarketplaceEmptyStateProps {
  // Se algum filtro (busca/categoria/cidade/estado/preço) está ativo — distingue
  // "esses filtros não bateram com nada" (tem fornecedor em algum lugar, oferece
  // limpar filtros) de "o marketplace ainda não tem fornecedor nenhum" (realidade
  // de pré-lançamento — não faz sentido oferecer "limpar filtros" quando não há
  // filtro nenhum pra limpar).
  hasFilters: boolean
}

function StoreOffIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M4 9V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5" />
      <path d="M2 9l1.65-5.79A2 2 0 0 1 5.56 2h12.88a2 2 0 0 1 1.91 1.21L22 9" />
      <path d="M2 9a2.5 2.5 0 0 0 5 0M12 9a2.5 2.5 0 0 0 5 .5" />
      <path d="M9 22v-5a1 1 0 0 1 1-1h4" />
    </svg>
  )
}

export default function VendorMarketplaceEmptyState({ hasFilters }: VendorMarketplaceEmptyStateProps) {
  return (
    <div
      className="rounded-2xl bg-[var(--surface)] p-10 text-center"
      style={{ boxShadow: 'var(--shadow), var(--shadow-lg)' }}
    >
      <div style={{ color: 'var(--muted-fg)', marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
        <StoreOffIcon />
      </div>
      <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(20px,3vw,24px)', color: 'var(--fg)', margin: '0 0 8px' }}>
        {hasFilters ? 'Nenhum fornecedor encontrado com esses filtros' : 'Ainda não há fornecedores por aqui'}
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 auto', maxWidth: '380px', lineHeight: 1.6 }}>
        {hasFilters
          ? 'Tente ajustar a busca, a categoria ou a cidade — ou limpe os filtros para ver todos os fornecedores disponíveis.'
          : 'Estamos no começo do marketplace de fornecedores — novos parceiros aparecem aqui assim que forem aprovados.'}
      </p>
      {hasFilters && (
        <Link
          href="/fornecedores"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '18px',
            background: 'var(--wedding-color)', color: '#fff', textDecoration: 'none',
            borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
          }}
        >
          Limpar filtros
        </Link>
      )}
    </div>
  )
}
