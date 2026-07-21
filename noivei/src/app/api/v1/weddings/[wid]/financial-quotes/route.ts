import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateFinancialQuoteSchema } from '@/lib/api/validation/financial-quote.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan } from '@/constants/plans'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialQuote } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const { data, error } = await supabase
      .from('financial_quotes')
      .select('*')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar orçamentos.')

    return ok((data ?? []) as FinancialQuote[])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    // Reforço server-side: a aba "Orçamentos" já é escondida no client pro Gratuito,
    // mas isso é só UX — sem essa checagem aqui, uma chamada direta à API contornaria
    // o gate de plano.
    const planId = await resolveWeddingPlanId(supabase, wid)
    if (!isPaidPlan(planId)) {
      return err(403, 'PREMIUM_REQUIRED', 'Orçamentos por categoria é um recurso do plano Premium.')
    }

    const body = await parseJsonBody(req)
    const parsed = CreateFinancialQuoteSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('financial_quotes')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar orçamento.')

    return ok(data as FinancialQuote, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
