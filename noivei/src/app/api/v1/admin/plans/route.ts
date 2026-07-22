import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

export interface AdminPlanLimit {
  id:      string
  feature: string
  value:   number
}

export interface AdminPlan {
  id:          string
  name:        string
  description: string | null
  price_brl:   number
  is_active:   boolean
  limits:      AdminPlanLimit[]
}

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const [{ data: plans, error: plansError }, { data: limits, error: limitsError }] = await Promise.all([
      supabase.from('plans').select('id, name, description, price_brl, is_active').order('price_brl', { ascending: true }),
      supabase.from('plan_limits').select('id, plan_id, feature, value').order('feature', { ascending: true }),
    ])

    if (plansError || limitsError) return err(500, 'DB_ERROR', 'Erro ao listar planos.')

    const result: AdminPlan[] = (plans ?? []).map((plan) => ({
      id:          plan.id as string,
      name:        plan.name as string,
      description: plan.description as string | null,
      price_brl:   plan.price_brl as number,
      is_active:   plan.is_active as boolean,
      limits: (limits ?? [])
        .filter((limit) => limit.plan_id === plan.id)
        .map((limit) => ({ id: limit.id as string, feature: limit.feature as string, value: limit.value as number })),
    }))

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
