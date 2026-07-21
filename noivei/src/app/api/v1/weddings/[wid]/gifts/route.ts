import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateGiftRegistryItemSchema } from '@/lib/api/validation/gift.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GiftRegistryItem } from '@/types/database'

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
      .from('gift_registry_items')
      .select('*')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar itens da lista de presentes.')

    return ok((data ?? []) as GiftRegistryItem[])
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

    const body = await parseJsonBody(req)
    const parsed = CreateGiftRegistryItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar item da lista de presentes.')

    return ok(data as GiftRegistryItem, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
