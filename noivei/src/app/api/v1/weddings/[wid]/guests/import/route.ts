import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { ImportGuestRowSchema, type ImportGuestRow } from '@/lib/api/validation/guest.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { Guest } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

const MAX_ROWS = 500

interface RowError {
  line:    number
  message: string
}

/**
 * Importa convidados em lote a partir de CSV em texto puro no body.
 * Formato: nome,email,grupo (uma linha por convidado, separador vírgula,
 * sem suporte a campos entre aspas). Linha de cabeçalho "nome,..." é ignorada.
 * Import é tudo-ou-nada: qualquer linha inválida rejeita o lote inteiro (400).
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    const csv = (await req.text()).trim()
    if (!csv) return err(400, 'EMPTY_CSV', 'Nenhum conteúdo CSV enviado.')

    const lines = csv
      .split(/\r?\n/)
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => line.trim().length > 0)

    // Descarta linha de cabeçalho opcional (ex: "nome,email,grupo")
    const first = lines[0]
    const rows = first && /^nome\s*(,|$)/i.test(first.line.trim()) ? lines.slice(1) : lines

    if (rows.length === 0) return err(400, 'EMPTY_CSV', 'Nenhum convidado para importar.')
    if (rows.length > MAX_ROWS) {
      return err(400, 'CSV_TOO_LARGE', `Máximo de ${MAX_ROWS} convidados por importação.`)
    }

    const guests: ImportGuestRow[] = []
    const rowErrors: RowError[] = []

    for (const { line, number } of rows) {
      const [name = '', email = '', groupName = ''] = line.split(',').map((part) => part.trim())

      const parsed = ImportGuestRowSchema.safeParse({
        name,
        email:      email || null,
        group_name: groupName || null,
      })

      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Linha inválida.'
        rowErrors.push({ line: number, message })
        continue
      }

      guests.push(parsed.data)
    }

    if (rowErrors.length > 0) {
      return err(400, 'CSV_INVALID', 'O CSV contém linhas inválidas.', rowErrors)
    }

    const { data, error } = await supabase
      .from('guests')
      .insert(guests.map((guest) => ({ ...guest, wedding_id: wid })))
      .select()

    if (error) return err(500, 'DB_ERROR', 'Erro ao importar convidados.')

    const inserted = (data ?? []) as Guest[]

    return ok(inserted, { imported: inserted.length }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
