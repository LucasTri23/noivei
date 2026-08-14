import type { SupabaseClient } from '@supabase/supabase-js'

import type { VendorMarketplaceFilters } from '@/lib/vendor/marketplace-filters'

// Teto de resultados por busca — o dataset esperado é pequeno por um bom tempo
// (marketplace em pré-lançamento), então uma única página sem paginação de
// verdade é suficiente por agora; ver nota de revisão futura no relatório da fase.
const VENDOR_LIST_LIMIT = 60

export interface VendorListCategory {
  id:    string
  slug:  string
  label: string
}

export interface VendorListItem {
  id:            string
  slug:          string
  business_name: string
  city:          string | null
  state:         string | null
  price_range:   string | null
  description:   string | null
  categories:    VendorListCategory[]
}

/**
 * Lista fornecedores publicamente visíveis pro marketplace autenticado
 * (/fornecedores), já filtrados e com as categorias de cada um resolvidas.
 *
 * NUNCA reimplementa a regra de "é público" — a RLS de vendor_profiles/
 * vendor_category_links (fn_vendor_is_publicly_visible, ver migration
 * 20260806000003) já garante isso; esta função só filtra dentro do conjunto que
 * a RLS já devolveu. `supabase` precisa ser um client autenticado (createSupabaseServer),
 * nunca service role — é o client normal que faz a RLS valer.
 *
 * `ilike` simples (não full-text search): dataset esperado pequeno no lançamento,
 * full-text seria over-engineering agora — revisitar se o marketplace crescer.
 */
export async function listVendors(
  supabase: SupabaseClient,
  filters:  VendorMarketplaceFilters,
): Promise<VendorListItem[]> {
  let vendorIdFilter: string[] | null = null

  if (filters.categoria) {
    const { data: category } = await supabase
      .from('vendor_categories')
      .select('id')
      .eq('slug', filters.categoria)
      .maybeSingle()

    if (!category) return []

    const { data: links } = await supabase
      .from('vendor_category_links')
      .select('vendor_id')
      .eq('category_id', category.id as string)

    vendorIdFilter = ((links ?? []) as { vendor_id: string }[]).map((link) => link.vendor_id)
    if (vendorIdFilter.length === 0) return []
  }

  let query = supabase
    .from('vendor_profiles')
    .select('id, slug, business_name, city, state, price_range, description')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(VENDOR_LIST_LIMIT)

  if (vendorIdFilter) query = query.in('id', vendorIdFilter)
  if (filters.cidade) query = query.ilike('city', `%${filters.cidade}%`)
  if (filters.estado) query = query.ilike('state', `%${filters.estado}%`)
  if (filters.preco)  query = query.eq('price_range', filters.preco)

  if (filters.busca) {
    // Escapa vírgula/parênteses (delimitadores do .or() do PostgREST) — busca
    // literal, nunca deveria virar sintaxe de filtro por causa do texto digitado.
    const term = filters.busca.replace(/[,()]/g, ' ').trim()
    if (term) {
      const pattern = `%${term}%`
      query = query.or(`business_name.ilike.${pattern},description.ilike.${pattern},city.ilike.${pattern}`)
    }
  }

  const { data: vendors, error } = await query
  if (error || !vendors) return []

  const vendorIds = vendors.map((vendor) => vendor.id as string)
  const categoriesByVendor = await fetchCategoriesForVendors(supabase, vendorIds)

  return vendors.map((vendor) => ({
    id:            vendor.id as string,
    slug:          vendor.slug as string,
    business_name: vendor.business_name as string,
    city:          vendor.city as string | null,
    state:         vendor.state as string | null,
    price_range:   vendor.price_range as string | null,
    description:   vendor.description as string | null,
    categories:    categoriesByVendor.get(vendor.id as string) ?? [],
  }))
}

async function fetchCategoriesForVendors(
  supabase:  SupabaseClient,
  vendorIds: string[],
): Promise<Map<string, VendorListCategory[]>> {
  const result = new Map<string, VendorListCategory[]>()
  if (vendorIds.length === 0) return result

  const { data: links } = await supabase
    .from('vendor_category_links')
    .select('vendor_id, vendor_categories(id, slug, label)')
    .in('vendor_id', vendorIds)

  // O client não sabe que vendor_category_links → vendor_categories é N:1 (FK sem
  // metadado de cardinalidade no types/database.ts feito à mão, diferente de um
  // schema gerado) — tipa o embed como array mesmo sendo sempre 0 ou 1 linha na
  // prática (category_id é NOT NULL + FK, então é sempre exatamente 1).
  type LinkRow = { vendor_id: string; vendor_categories: unknown }
  for (const link of (links ?? []) as LinkRow[]) {
    const category = (Array.isArray(link.vendor_categories) ? link.vendor_categories[0] : link.vendor_categories) as
      VendorListCategory | null | undefined
    if (!category) continue
    const list = result.get(link.vendor_id) ?? []
    list.push(category)
    result.set(link.vendor_id, list)
  }

  return result
}

/** Todas as categorias ativas, pra montar as pílulas de filtro — leitura pública, sem gating. */
export async function listActiveVendorCategories(supabase: SupabaseClient): Promise<VendorListCategory[]> {
  const { data } = await supabase
    .from('vendor_categories')
    .select('id, slug, label')
    .eq('active', true)
    .order('sort_order')

  return (data ?? []) as VendorListCategory[]
}
