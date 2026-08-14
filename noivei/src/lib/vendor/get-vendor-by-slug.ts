import type { SupabaseClient } from '@supabase/supabase-js'

import type { VendorListCategory } from '@/lib/vendor/list-vendors'

export interface PublicVendorProfile {
  id:                 string
  business_name:      string
  slug:               string
  whatsapp:           string | null
  show_whatsapp:      boolean
  instagram:          string | null
  website:            string | null
  city:               string | null
  state:              string | null
  description:        string | null
  price_range:        string | null
  cover_storage_path: string | null
  categories:         VendorListCategory[]
}

/**
 * Busca o perfil público de um fornecedor pelo slug (/profissionais/[slug]).
 *
 * Diferente de getPublicSiteBySlug/getAlbumBySlug (que exigem service role porque
 * site_config não tem policy pública), `vendor_profiles` JÁ tem uma policy de
 * SELECT pública via fn_vendor_is_publicly_visible (migration 20260806000003) —
 * então um client comum (anon/authenticated, createSupabaseServer) já só enxerga
 * fornecedores publicamente visíveis. Retorna `null` tanto pra slug inexistente
 * quanto pra fornecedor não-público (draft/pending_review/suspended/rejected) —
 * mesmo erro genérico nos dois casos, pra não vazar a existência de um cadastro
 * ainda não aprovado (mesma disciplina de privacidade de requireVendorProfile).
 */
export async function getVendorBySlug(
  supabase: SupabaseClient,
  slug:     string,
): Promise<PublicVendorProfile | null> {
  const { data: vendor, error } = await supabase
    .from('vendor_profiles')
    .select('id, business_name, slug, whatsapp, show_whatsapp, instagram, website, city, state, description, price_range, cover_storage_path')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !vendor) return null

  const { data: links } = await supabase
    .from('vendor_category_links')
    .select('vendor_categories(id, slug, label)')
    .eq('vendor_id', vendor.id as string)

  // Mesmo motivo do cast em list-vendors.ts/fetchCategoriesForVendors: o client não
  // sabe que o embed é N:1, tipa como array mesmo sendo sempre 0 ou 1 linha.
  const categories = ((links ?? []) as { vendor_categories: unknown }[])
    .map((link) => (Array.isArray(link.vendor_categories) ? link.vendor_categories[0] : link.vendor_categories))
    .filter((category): category is VendorListCategory => Boolean(category))

  return {
    id:                 vendor.id as string,
    business_name:      vendor.business_name as string,
    slug:               vendor.slug as string,
    whatsapp:           vendor.whatsapp as string | null,
    show_whatsapp:      vendor.show_whatsapp as boolean,
    instagram:          vendor.instagram as string | null,
    website:            vendor.website as string | null,
    city:               vendor.city as string | null,
    state:              vendor.state as string | null,
    description:        vendor.description as string | null,
    price_range:        vendor.price_range as string | null,
    cover_storage_path: vendor.cover_storage_path as string | null,
    categories,
  }
}
