import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorAdminAction, VendorCategory, VendorProfile, VendorSubscription } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

export interface AdminVendorDetail {
  vendor:         VendorProfile
  categories:     VendorCategory[]
  portfolio_count: number
  subscriptions:  VendorSubscription[]
  admin_actions:  VendorAdminAction[]
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const { data: vendor, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (vendorError) return err(500, 'DB_ERROR', 'Erro ao buscar fornecedor.')
    if (!vendor) return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')

    const [
      { data: categoryLinks },
      { count: portfolioCount },
      { data: subscriptions },
      { data: adminActions },
    ] = await Promise.all([
      supabase.from('vendor_category_links').select('vendor_categories(*)').eq('vendor_id', id),
      supabase.from('vendor_portfolio_items').select('*', { count: 'exact', head: true }).eq('vendor_id', id),
      supabase.from('vendor_subscriptions').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
      supabase.from('vendor_admin_actions').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
    ])

    const categories = ((categoryLinks ?? []) as unknown as { vendor_categories: VendorCategory | null }[])
      .map((link) => link.vendor_categories)
      .filter((c): c is VendorCategory => c !== null)

    const result: AdminVendorDetail = {
      vendor:          vendor as VendorProfile,
      categories,
      portfolio_count: portfolioCount ?? 0,
      subscriptions:   (subscriptions ?? []) as VendorSubscription[],
      admin_actions:   (adminActions ?? []) as VendorAdminAction[],
    }

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
