import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateGuestSchema } from '@/lib/api/validation/guest.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

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
      return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateGuestSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('guests')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar convidado.')
    if (!data) return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')

    return ok(data as Guest)
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
      return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')
    }

    const { data, error } = await supabase
      .from('guests')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover convidado.')
    if (!data) return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
