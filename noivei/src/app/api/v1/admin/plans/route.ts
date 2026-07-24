import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreatePlanSchema } from '@/lib/api/validation/admin-plan.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

export interface AdminPlanLimit {
  id:      string
  feature: string
  value:   number
}

export interface AdminPlan {
  id:            string
  name:          string
  description:   string | null
  price_brl:     number
  is_active:     boolean
  group_key:     string | null
  billing_label: string | null
  billing_note:  string | null
  emoji:         string
  highlight:     boolean
  sort_order:    number
  limits:        AdminPlanLimit[]
}

const PLAN_COLUMNS =
  'id, name, description, price_brl, is_active, group_key, billing_label, billing_note, emoji, highlight, sort_order'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const [{ data: plans, error: plansError }, { data: limits, error: limitsError }] = await Promise.all([
      supabase.from('plans').select(PLAN_COLUMNS).order('sort_order', { ascending: true }),
      supabase.from('plan_limits').select('id, plan_id, feature, value').order('feature', { ascending: true }),
    ])

    if (plansError || limitsError) return err(500, 'DB_ERROR', 'Erro ao listar planos.')

    const result: AdminPlan[] = (plans ?? []).map((plan) => ({
      id:            plan.id as string,
      name:          plan.name as string,
      description:   plan.description as string | null,
      price_brl:     plan.price_brl as number,
      is_active:     plan.is_active as boolean,
      group_key:     plan.group_key as string | null,
      billing_label: plan.billing_label as string | null,
      billing_note:  plan.billing_note as string | null,
      emoji:         plan.emoji as string,
      highlight:     plan.highlight as boolean,
      sort_order:    plan.sort_order as number,
      limits: (limits ?? [])
        .filter((limit) => limit.plan_id === plan.id)
        .map((limit) => ({ id: limit.id as string, feature: limit.feature as string, value: limit.value as number })),
    }))

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = CreatePlanSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('plans')
      .insert(parsed.data)
      .select(PLAN_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') return err(409, 'PLAN_ID_TAKEN', 'Já existe um plano com esse id.')
      return err(500, 'DB_ERROR', 'Erro ao criar plano.')
    }

    const created: AdminPlan = {
      id:            data.id as string,
      name:          data.name as string,
      description:   data.description as string | null,
      price_brl:     data.price_brl as number,
      is_active:     data.is_active as boolean,
      group_key:     data.group_key as string | null,
      billing_label: data.billing_label as string | null,
      billing_note:  data.billing_note as string | null,
      emoji:         data.emoji as string,
      highlight:     data.highlight as boolean,
      sort_order:    data.sort_order as number,
      limits:        [],
    }

    return ok(created, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
