import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateGiftRegistryItemSchema } from '@/lib/api/validation/gift.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GiftRegistryItem } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateGiftRegistryItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar item da lista de presentes.')
    if (!data) return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')

    return ok(data as GiftRegistryItem)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover item da lista de presentes.')
    if (!data) return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
