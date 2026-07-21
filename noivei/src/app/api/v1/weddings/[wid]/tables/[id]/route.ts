import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateTableSchema } from '@/lib/api/validation/table.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { TableConfig } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'mesas')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateTableSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: tableData, error: tableError } = await supabase
      .from('tables_config')
      .select('id, capacity')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (tableError) return err(500, 'DB_ERROR', 'Erro ao buscar mesa.')
    if (!tableData) return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')

    if (parsed.data.capacity !== undefined) {
      const { count, error: countError } = await supabase
        .from('table_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('table_id', id)

      if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar ocupação da mesa.')
      if (parsed.data.capacity < (count ?? 0)) {
        return err(
          409,
          'CAPACITY_BELOW_OCCUPANCY',
          'A nova capacidade não pode ser menor que o número de convidados já alocados nesta mesa.',
          { occupied: count ?? 0 },
        )
      }
    }

    const { data, error } = await supabase
      .from('tables_config')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar mesa.')

    return ok(data as TableConfig)
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
    await requireModuleAccess(supabase, wid, user.id, 'mesas')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    }

    const { data, error } = await supabase
      .from('tables_config')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao excluir mesa.')
    if (!data) return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
