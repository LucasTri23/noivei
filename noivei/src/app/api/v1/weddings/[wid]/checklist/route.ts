import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateChecklistItemSchema } from '@/lib/api/validation/checklist.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { ChecklistItem } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'checklist')

    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar itens do checklist.')

    return ok((data ?? []) as ChecklistItem[])
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
    await requireModuleAccess(supabase, wid, user.id, 'checklist')

    const body = await parseJsonBody(req)
    const parsed = CreateChecklistItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar item do checklist.')

    return ok(data as ChecklistItem, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
