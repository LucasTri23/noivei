import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { AssignGuestSchema } from '@/lib/api/validation/table.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { TableAssignment, TableConfig } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = AssignGuestSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }
    const { guest_id: guestId } = parsed.data

    const { data: tableData, error: tableError } = await supabase
      .from('tables_config')
      .select('id, capacity')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (tableError) return err(500, 'DB_ERROR', 'Erro ao buscar mesa.')
    if (!tableData) return err(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    const table = tableData as Pick<TableConfig, 'id' | 'capacity'>

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id')
      .eq('id', guestId)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (guestError) return err(500, 'DB_ERROR', 'Erro ao buscar convidado.')
    if (!guest) return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')

    const { data: existing, error: existingError } = await supabase
      .from('table_assignments')
      .select('table_id')
      .eq('guest_id', guestId)
      .maybeSingle()

    if (existingError) return err(500, 'DB_ERROR', 'Erro ao verificar alocação existente.')
    if (existing) {
      return err(409, 'GUEST_ALREADY_ASSIGNED', 'Convidado já está alocado em uma mesa.', {
        table_id: (existing as Pick<TableAssignment, 'table_id'>).table_id,
      })
    }

    const { count, error: countError } = await supabase
      .from('table_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', id)

    if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar ocupação da mesa.')
    if ((count ?? 0) >= table.capacity) {
      return err(409, 'TABLE_FULL', 'A mesa já atingiu a capacidade máxima.', {
        capacity: table.capacity,
        occupied: count ?? 0,
      })
    }

    const { data, error } = await supabase
      .from('table_assignments')
      .insert({ table_id: id, guest_id: guestId })
      .select()
      .single()

    if (error) {
      // Corrida com o UNIQUE(guest_id): outro request alocou o convidado antes
      if (error.code === '23505') {
        return err(409, 'GUEST_ALREADY_ASSIGNED', 'Convidado já está alocado em uma mesa.')
      }
      return err(500, 'DB_ERROR', 'Erro ao alocar convidado.')
    }

    return ok(data as TableAssignment, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
