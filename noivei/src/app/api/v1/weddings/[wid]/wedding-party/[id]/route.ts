import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateWeddingPartyEntrySchema } from '@/lib/api/validation/wedding-party.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingPartyEntry } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'padrinhos')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'WEDDING_PARTY_ENTRY_NOT_FOUND', 'Entrada do cortejo não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateWeddingPartyEntrySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    if (parsed.data.paired_with_entry_id) {
      if (parsed.data.paired_with_entry_id === id) {
        return err(400, 'VALIDATION_ERROR', 'Uma entrada não pode ser par de si mesma.')
      }

      const { data: pairEntry, error: pairError } = await supabase
        .from('wedding_party_entries')
        .select('id')
        .eq('id', parsed.data.paired_with_entry_id)
        .eq('wedding_id', wid)
        .maybeSingle()

      if (pairError) return err(500, 'DB_ERROR', 'Erro ao verificar o par informado.')
      if (!pairEntry) return err(404, 'PAIR_ENTRY_NOT_FOUND', 'Entrada do par não encontrada.')
    }

    const { data, error } = await supabase
      .from('wedding_party_entries')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar entrada do cortejo.')
    if (!data) return err(404, 'WEDDING_PARTY_ENTRY_NOT_FOUND', 'Entrada do cortejo não encontrada.')

    return ok(data as WeddingPartyEntry)
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
    await requireModuleAccess(supabase, wid, user.id, 'padrinhos')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'WEDDING_PARTY_ENTRY_NOT_FOUND', 'Entrada do cortejo não encontrada.')
    }

    const { data, error } = await supabase
      .from('wedding_party_entries')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover entrada do cortejo.')
    if (!data) return err(404, 'WEDDING_PARTY_ENTRY_NOT_FOUND', 'Entrada do cortejo não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
