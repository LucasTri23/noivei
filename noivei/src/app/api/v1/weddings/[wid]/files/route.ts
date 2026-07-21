import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateWeddingFileSchema } from '@/lib/api/validation/file.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingFile } from '@/types/database'

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
      .from('wedding_files')
      .select('*')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar arquivos.')

    return ok((data ?? []) as WeddingFile[])
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
    const parsed = CreateWeddingFileSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    // O upload dos bytes já aconteceu direto no Storage (client -> bucket); aqui só
    // registramos os metadados. O path precisa começar com o wedding_id porque é isso
    // que a policy de storage.objects usa para checar posse do arquivo.
    if (!parsed.data.storage_path.startsWith(`${wid}/`)) {
      return err(400, 'VALIDATION_ERROR', 'Caminho de armazenamento inválido para este casamento.')
    }

    // `size_bytes` do body é o que o client alega, não o que foi de fato gravado no
    // Storage — sem conferir aqui, dava pra mentir um valor baixo e furar a cota do
    // plano indefinidamente. `list()` retorna os metadados reais do objeto gravado.
    const objectName = parsed.data.storage_path.slice(wid.length + 1)
    const { data: listing, error: listError } = await supabase.storage
      .from('wedding-files')
      .list(wid, { search: objectName })

    const storedObject = listing?.find((item) => item.name === objectName)
    if (listError || !storedObject) {
      return err(400, 'VALIDATION_ERROR', 'Arquivo não encontrado no armazenamento. Envie novamente.')
    }

    const actualSizeBytes = (storedObject.metadata?.size as number | undefined) ?? parsed.data.size_bytes

    const limitCheck = await checkStorageLimit(supabase, wid, actualSizeBytes)
    if (!limitCheck.allowed) {
      return err(403, 'STORAGE_LIMIT_EXCEEDED', 'Limite de armazenamento do seu plano atingido.', {
        current: limitCheck.current,
        limit:   limitCheck.limit,
      })
    }

    const { data, error } = await supabase
      .from('wedding_files')
      .insert({ ...parsed.data, size_bytes: actualSizeBytes, wedding_id: wid, uploaded_by: user.id })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao registrar arquivo.')

    return ok(data as WeddingFile, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
