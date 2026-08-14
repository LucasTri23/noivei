// Filtros do marketplace autenticado (/fornecedores) — nomes de query param em
// português, pedido explícito do dono do produto (?categoria=...&cidade=...), lidos
// direto de searchParams do App Router (sempre string | string[] | undefined).
export interface VendorMarketplaceFilters {
  busca?:     string
  categoria?: string
  cidade?:    string
  estado?:    string
  preco?:     '$' | '$$' | '$$$'
}

const VALID_PRICE_RANGES = new Set(['$', '$$', '$$$'])

type RawSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Normaliza os searchParams crus da rota (App Router) num objeto de filtros
 * tipado — string vazia/só espaço vira `undefined` (sem filtro), e um `preco`
 * fora do enum válido é descartado em vez de quebrar a query no Supabase.
 */
export function parseVendorMarketplaceFilters(searchParams: RawSearchParams): VendorMarketplaceFilters {
  const preco = firstValue(searchParams.preco)

  return {
    busca:     firstValue(searchParams.busca),
    categoria: firstValue(searchParams.categoria),
    cidade:    firstValue(searchParams.cidade),
    estado:    firstValue(searchParams.estado),
    preco:     preco && VALID_PRICE_RANGES.has(preco) ? (preco as '$' | '$$' | '$$$') : undefined,
  }
}

/** Se algum filtro (além da paginação) está ativo — usado para decidir qual estado vazio mostrar. */
export function hasActiveVendorFilters(filters: VendorMarketplaceFilters): boolean {
  return Boolean(filters.busca || filters.categoria || filters.cidade || filters.estado || filters.preco)
}

/**
 * Monta o href de `/fornecedores` preservando os demais filtros ativos — usado
 * tanto pelas pílulas de categoria quanto pelo link "limpar filtros" (chamado sem
 * `overrides`, que produz a URL base sem nenhum parâmetro).
 */
export function buildVendorMarketplaceHref(
  filters: VendorMarketplaceFilters,
  overrides: Partial<VendorMarketplaceFilters> = {},
): string {
  const merged = { ...filters, ...overrides }
  const qs = new URLSearchParams()

  if (merged.busca)     qs.set('busca', merged.busca)
  if (merged.categoria) qs.set('categoria', merged.categoria)
  if (merged.cidade)    qs.set('cidade', merged.cidade)
  if (merged.estado)    qs.set('estado', merged.estado)
  if (merged.preco)     qs.set('preco', merged.preco)

  const query = qs.toString()
  return query ? `/fornecedores?${query}` : '/fornecedores'
}
