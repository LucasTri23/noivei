import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateTableSchema } from '@/lib/api/validation/table.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest, TableConfig } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

type AssignedGuest = Pick<Guest, 'id' | 'name' | 'group_name' | 'status'>

interface TableRow extends TableConfig {
  table_assignments: { guest_id: string; guests: AssignedGuest | null }[]
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'mesas')

    const { data, error } = await supabase
      .from('tables_config')
      .select(
        'id, wedding_id, label, capacity, created_at, table_assignments(guest_id, guests(id, name, group_name, status))',
      )
      .eq('wedding_id', wid)
      .order('created_at', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar mesas.')

    const tables = ((data ?? []) as unknown as TableRow[]).map(
      ({ table_assignments, ...table }) => ({
        ...table,
        guests: table_assignments
          .map((assignment) => assignment.guests)
          .filter((guest): guest is AssignedGuest => guest !== null),
      }),
    )

    return ok(tables)
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
    await requireModuleAccess(supabase, wid, user.id, 'mesas')

    const body = await parseJsonBody(req)
    const parsed = CreateTableSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('tables_config')
      .insert({ ...parsed.data, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar mesa.')

    return ok(data as TableConfig, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
