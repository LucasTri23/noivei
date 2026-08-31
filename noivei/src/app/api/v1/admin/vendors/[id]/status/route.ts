import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { VendorAdminActionSchema } from '@/lib/api/validation/admin-vendor.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { MarketplaceVendorStatus, VendorProfile } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Toda transição de status disparada por ADMIN (a única que o próprio fornecedor
// pode disparar é draft/rejected -> pending_review, ver
// POST /api/v1/vendor/submit-for-review — rota separada, nunca esta). Mapa explícito
// de "de onde" cada ação pode partir — nunca aceita o status alvo vindo do client,
// só a ação; o status resultante é sempre fixo por ação (ver TARGET_STATUS).
const ALLOWED_FROM_STATUS: Record<string, MarketplaceVendorStatus[]> = {
  approve:    ['pending_review'],
  reject:     ['pending_review'],
  suspend:    ['active', 'paused'],
  reactivate: ['suspended'],
  pause:      ['active'],
}

const TARGET_STATUS: Record<string, MarketplaceVendorStatus> = {
  approve:    'active',
  reject:     'rejected',
  suspend:    'suspended',
  reactivate: 'active',
  pause:      'paused',
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-vendor-status:${user.id}`, 100, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = VendorAdminActionSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: vendor, error: fetchError } = await supabase
      .from('vendor_profiles')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar fornecedor.')
    if (!vendor) return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')

    const allowedFrom = ALLOWED_FROM_STATUS[parsed.data.action]!
    if (!allowedFrom.includes(vendor.status)) {
      return err(409, 'INVALID_STATUS_TRANSITION', 'Este fornecedor não está em um estado que permite essa ação.')
    }

    const targetStatus = TARGET_STATUS[parsed.data.action]!

    // .eq('status', vendor.status) é a garantia real contra corrida (dois admins
    // clicando ao mesmo tempo) — mesmo padrão de vendor/submit-for-review/route.ts.
    const { data: updated, error: updateError } = await supabase
      .from('vendor_profiles')
      .update({
        status:           targetStatus,
        rejection_reason: parsed.data.action === 'reject' || parsed.data.action === 'suspend'
          ? (parsed.data.reason ?? null)
          : null,
      })
      .eq('id', id)
      .eq('status', vendor.status)
      .select()
      .maybeSingle()

    if (updateError) return err(500, 'DB_ERROR', 'Erro ao atualizar fornecedor.')
    if (!updated) return err(409, 'INVALID_STATUS_TRANSITION', 'Este fornecedor não está em um estado que permite essa ação.')

    // vendor_admin_actions deixa de ser tabela morta — toda ação administrativa
    // sobre um fornecedor fica registrada (Fase 7/8).
    await supabase.from('vendor_admin_actions').insert({
      admin_id:  user.id,
      vendor_id: id,
      action:    parsed.data.action,
      reason:    parsed.data.reason ?? null,
    })

    return ok(updated as VendorProfile)
  } catch (error) {
    return handleApiError(error)
  }
}
