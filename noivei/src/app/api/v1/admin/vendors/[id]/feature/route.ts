import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { VendorFeatureToggleSchema } from '@/lib/api/validation/admin-vendor.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorProfile } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Marca/desmarca destaque — separado de status/route.ts porque não é uma transição
// de estado (um fornecedor 'active' pode ser featured=true/false livremente, nas
// duas direções, sem "de onde" restrito).
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-feature:${user.id}`, 100, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = VendorFeatureToggleSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_profiles')
      .update({ featured: parsed.data.featured })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar fornecedor.')
    if (!data) return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')

    await supabase.from('vendor_admin_actions').insert({
      admin_id:  user.id,
      vendor_id: id,
      action:    parsed.data.featured ? 'featured' : 'unfeatured',
    })

    return ok(data as VendorProfile)
  } catch (error) {
    return handleApiError(error)
  }
}
