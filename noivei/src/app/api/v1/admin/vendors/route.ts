import { parseJsonBody } from '@/lib/api/parse-body'
import { AdminCreateVendorSchema } from '@/lib/api/validation/admin-vendor.schema'
import { createSupabaseService } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { slugifyBusinessName } from '@/lib/vendor/slug'
import { deliverVendorEmails } from '@/lib/vendor/deliver-vendor-emails'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { MarketplaceVendorStatus } from '@/types/database'

const VENDOR_STATUSES: MarketplaceVendorStatus[] = ['draft', 'pending_review', 'active', 'paused', 'suspended', 'rejected']
const PAGE_SIZE = 50

export interface AdminVendorListRow {
  id:                string
  business_name:     string
  slug:              string
  city:              string | null
  state:             string | null
  status:            MarketplaceVendorStatus
  featured:          boolean
  created_at:        string
  category_labels:   string[]
  subscription_plan_id: string | null
  subscription_status:  string | null
}

// Listagem administrativa (Fase 7) — filtros em memória sobre um dataset pequeno
// (marketplace em pré-lançamento, mesmo raciocínio de list-vendors.ts do lado
// público: revisitar paginação/full-text search se o catálogo crescer muito).
export async function GET(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const url = new URL(req.url)
    const search   = url.searchParams.get('q')?.trim() ?? ''
    const status   = url.searchParams.get('status') ?? ''
    const category = url.searchParams.get('category') ?? ''

    let query = supabase
      .from('vendor_profiles')
      .select('id, business_name, slug, city, state, status, featured, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (search) query = query.ilike('business_name', `%${search}%`)
    if (status && VENDOR_STATUSES.includes(status as MarketplaceVendorStatus)) {
      query = query.eq('status', status as MarketplaceVendorStatus)
    }

    const { data: vendors, error: vendorsError } = await query
    if (vendorsError) return err(500, 'DB_ERROR', 'Erro ao listar fornecedores.')

    const vendorIds = (vendors ?? []).map((v) => v.id as string)
    if (vendorIds.length === 0) return ok([] as AdminVendorListRow[])

    const [{ data: categoryLinks }, { data: subscriptions }] = await Promise.all([
      supabase
        .from('vendor_category_links')
        .select('vendor_id, vendor_categories(label)')
        .in('vendor_id', vendorIds),
      supabase
        .from('vendor_subscriptions')
        .select('vendor_id, plan_id, status, created_at')
        .in('vendor_id', vendorIds)
        .order('created_at', { ascending: false }),
    ])

    const categoriesByVendor = new Map<string, string[]>()
    for (const link of (categoryLinks ?? []) as unknown as { vendor_id: string; vendor_categories: { label: string } | null }[]) {
      const label = link.vendor_categories?.label
      if (!label) continue
      const list = categoriesByVendor.get(link.vendor_id) ?? []
      list.push(label)
      categoriesByVendor.set(link.vendor_id, list)
    }

    // A mais recente por fornecedor — subscriptions já veio ordenado desc, primeira
    // ocorrência de cada vendor_id é a mais recente.
    const latestSubByVendor = new Map<string, { plan_id: string; status: string }>()
    for (const sub of (subscriptions ?? []) as { vendor_id: string; plan_id: string; status: string }[]) {
      if (!latestSubByVendor.has(sub.vendor_id)) latestSubByVendor.set(sub.vendor_id, sub)
    }

    let rows: AdminVendorListRow[] = (vendors ?? []).map((v) => ({
      id:                    v.id as string,
      business_name:         v.business_name as string,
      slug:                  v.slug as string,
      city:                  v.city as string | null,
      state:                 v.state as string | null,
      status:                v.status as MarketplaceVendorStatus,
      featured:              v.featured as boolean,
      created_at:            v.created_at as string,
      category_labels:       categoriesByVendor.get(v.id as string) ?? [],
      subscription_plan_id:  latestSubByVendor.get(v.id as string)?.plan_id ?? null,
      subscription_status:   latestSubByVendor.get(v.id as string)?.status ?? null,
    }))

    if (category) {
      rows = rows.filter((row) => row.category_labels.some((label) => label.toLowerCase() === category.toLowerCase()))
    }

    return ok(rows)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)
    const limit = await checkRateLimit(supabase, 'admin-create-vendor:' + user.id, 20, 3600)
    if (!limit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco.')
    const parsed = AdminCreateVendorSchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Revise o e-mail, CNPJ e as categorias.', parsed.error.flatten())
    const { email, category_ids, ...profile } = parsed.data

    // Valida antes de convidar; a RPC repete a checagem dentro da transação.
    const { data: categories, error: categoryError } = await supabase.from('vendor_categories')
      .select('id').in('id', category_ids).eq('active', true)
    if (categoryError) return err(500, 'DB_ERROR', 'Erro ao verificar categorias.')
    if (categories?.length !== category_ids.length) return err(400, 'INVALID_CATEGORIES', 'Selecione categorias ativas.')

    const service = createSupabaseService()
    const { data: accountId, error: lookupError } = await service.rpc('fn_vendor_account_by_email', { p_email: email })
    if (lookupError) return err(500, 'DB_ERROR', 'Erro ao localizar a conta do fornecedor.')
    let targetUserId = accountId as string | null
    let invited = false
    if (!targetUserId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!appUrl) return err(503, 'INVITE_NOT_CONFIGURED', 'Configure a URL do site para enviar convites.')
      const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: appUrl.replace(/\/$/, '') + '/reset-password?next=/fornecedor',
      })
      if (inviteError || !invitation.user) {
        return err(502, 'INVITE_FAILED', 'Não foi possível enviar o convite. Confira o e-mail e tente novamente.')
      }
      targetUserId = invitation.user.id
      invited = true
    }
    const { data: vendorId, error: createError } = await supabase.rpc('fn_admin_create_vendor', {
      p_user_id: targetUserId,
      p_profile: profile,
      p_category_ids: category_ids,
      p_slug: slugifyBusinessName(profile.business_name) + '-' + crypto.randomUUID().slice(0, 8),
    })
    if (createError) {
      if (createError.code === '23505') return err(409, 'VENDOR_ALREADY_EXISTS', 'Essa conta já possui um cadastro de fornecedor.')
      if (createError.code === '22023' || createError.code === '23514') return err(400, 'VALIDATION_ERROR', 'Confira o CNPJ e as categorias selecionadas.')
      console.error('[admin/vendors] Falha ao cadastrar fornecedor:', createError.code)
      return err(500, 'DB_ERROR', invited
        ? 'O convite foi enviado, mas o perfil não foi salvo. Tente cadastrar novamente com o mesmo e-mail.'
        : 'Não foi possível cadastrar o fornecedor.')
    }
    await deliverVendorEmails(vendorId as string)
    return ok({ id: vendorId, invited }, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
