import Link from 'next/link'

import type { VendorListCategory } from '@/lib/vendor/list-vendors'
import {
  buildVendorMarketplaceHref,
  hasActiveVendorFilters,
  type VendorMarketplaceFilters,
} from '@/lib/vendor/marketplace-filters'

interface VendorMarketplaceFilterBarProps {
  categories: VendorListCategory[]
  filters:    VendorMarketplaceFilters
}

const PRICE_RANGE_OPTIONS = ['$', '$$', '$$$'] as const

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    border: 'none', borderRadius: '999px', padding: '7px 16px',
    fontSize: '13px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
    background: active ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
    color: active ? '#fff' : 'var(--wedding-color-dark)',
    transition: 'background 0.15s, color 0.15s',
  }
}

const fieldLabelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', color: 'var(--muted-fg)' }
const fieldInputStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 10px', fontSize: '13.5px', color: 'var(--fg)', background: 'var(--surface)' }

// Barra de filtro do marketplace — 100% server-rendered (form GET + links), sem
// nenhum client component: pílulas de categoria são <Link> reais que preservam os
// demais filtros na URL (buildVendorMarketplaceHref), mesma convenção de
// query-param-preserving já usada em /admin/usuarios (buildHref). Funciona sem
// JavaScript, é indexável e evita duplicar estado de filtro em dois lugares
// (URL + client state). Pílulas com overflow-x-auto no mobile (não empilham,
// rolam horizontalmente) — mesma ideia da aba de categorias do
// file-archive-manager, adaptada pra rolagem em vez de quebra de linha.
export default function VendorMarketplaceFilterBar({ categories, filters }: VendorMarketplaceFilterBarProps) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Filtrar fornecedores por categoria"
        className="flex gap-2 overflow-x-auto"
        style={{ paddingBottom: '6px', marginBottom: '16px', scrollbarWidth: 'thin' }}
      >
        <Link
          role="tab"
          aria-selected={!filters.categoria}
          href={buildVendorMarketplaceHref(filters, { categoria: undefined })}
          style={pillStyle(!filters.categoria)}
        >
          Todos
        </Link>
        {categories.map((category) => {
          const active = filters.categoria === category.slug
          return (
            <Link
              key={category.id}
              role="tab"
              aria-selected={active}
              href={buildVendorMarketplaceHref(filters, { categoria: active ? undefined : category.slug })}
              style={pillStyle(active)}
            >
              {category.label}
            </Link>
          )
        })}
      </div>

      <form
        method="get"
        action="/fornecedores"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow), var(--shadow-lg)' }}
      >
        {/* A categoria já vive na URL via pílula — o form precisa reenviá-la
            escondida, senão submeter a busca zeraria o filtro de categoria ativo. */}
        <input type="hidden" name="categoria" value={filters.categoria ?? ''} />

        <label style={{ ...fieldLabelStyle, flex: '1 1 220px' }}>
          Buscar
          <input
            type="text"
            name="busca"
            defaultValue={filters.busca ?? ''}
            placeholder="Nome, descrição ou cidade"
            style={fieldInputStyle}
          />
        </label>

        <label style={fieldLabelStyle}>
          Cidade
          <input
            type="text"
            name="cidade"
            defaultValue={filters.cidade ?? ''}
            placeholder="Ex: Curitiba"
            style={{ ...fieldInputStyle, minWidth: '140px' }}
          />
        </label>

        <label style={fieldLabelStyle}>
          Estado
          <input
            type="text"
            name="estado"
            defaultValue={filters.estado ?? ''}
            placeholder="Ex: PR"
            maxLength={2}
            style={{ ...fieldInputStyle, width: '80px' }}
          />
        </label>

        <label style={fieldLabelStyle}>
          Faixa de preço
          <select name="preco" defaultValue={filters.preco ?? ''} style={{ ...fieldInputStyle, minWidth: '120px' }}>
            <option value="">Todas</option>
            {PRICE_RANGE_OPTIONS.map((price) => (
              <option key={price} value={price}>{price}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          style={{
            background: 'var(--wedding-color)', color: '#fff', border: 'none', borderRadius: '10px',
            padding: '9px 20px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Filtrar
        </button>

        {hasActiveVendorFilters(filters) && (
          <Link href="/fornecedores" style={{ fontSize: '13px', color: 'var(--muted-fg)', textDecoration: 'underline' }}>
            Limpar filtros
          </Link>
        )}
      </form>
    </div>
  )
}
