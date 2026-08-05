import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateFinancialEntrySchema } from '@/lib/api/validation/financial.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkFinancialEntryLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { FinancialEntry } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

interface CategoryTotals {
  total_amount: number
  paid_amount:  number
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    const { data, error } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: true })
      // Defesa em profundidade: checkFinancialEntryLimit já restringe o volume real de
      // lançamentos pelo plano; este teto só evita devolver a tabela inteira.
      .limit(1000)

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar lançamentos financeiros.')

    const entries = (data ?? []) as FinancialEntry[]

    const totalsByCategory: Record<string, CategoryTotals> = {}
    for (const entry of entries) {
      const totals = totalsByCategory[entry.category] ?? { total_amount: 0, paid_amount: 0 }
      totals.total_amount += entry.total_amount
      totals.paid_amount += entry.paid_amount
      totalsByCategory[entry.category] = totals
    }

    return ok({ entries, totals_by_category: totalsByCategory })
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
    await requireModuleAccess(supabase, wid, user.id, 'financeiro')

    const body = await parseJsonBody(req)
    const parsed = CreateFinancialEntrySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const limitCheck = await checkFinancialEntryLimit(supabase, wid)
    if (!limitCheck.allowed) {
      return err(
        403,
        'FINANCIAL_LIMIT_REACHED',
        `Você atingiu o limite de ${limitCheck.limit} lançamentos financeiros do seu plano.`,
        { current: limitCheck.current, limit: limitCheck.limit },
      )
    }

    // O client escolhe o anexo por id (já enviado ao bucket antes deste POST), mas nunca
    // confiamos que esse id realmente pertence a este casamento — sem esta checagem, um
    // wedding_id trocado no payload conseguiria vincular um lançamento a um arquivo de
    // OUTRO casamento. `.eq('wedding_id', wid)` garante que só um arquivo do próprio
    // casamento é aceito; qualquer outro caso (arquivo de outro casamento, ou inexistente)
    // é rejeitado com 400 antes de gravar.
    if (parsed.data.attached_file_id) {
      const { data: attachedFile, error: attachedFileError } = await supabase
        .from('wedding_files')
        .select('id')
        .eq('id', parsed.data.attached_file_id)
        .eq('wedding_id', wid)
        .maybeSingle()

      if (attachedFileError) return err(500, 'DB_ERROR', 'Erro ao verificar o arquivo anexado.')
      if (!attachedFile) {
        return err(400, 'VALIDATION_ERROR', 'Arquivo anexado não encontrado para este casamento.')
      }
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar lançamento financeiro.')

    return ok(data as FinancialEntry, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
