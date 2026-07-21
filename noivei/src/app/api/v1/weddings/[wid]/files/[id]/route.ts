import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

const SIGNED_URL_TTL_SECONDS = 60

// Retorna uma signed URL de download (não a URL do arquivo em si) — o bucket é privado
// e a signed URL expira em 60s, evitando link permanente compartilhável.
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado.')
    }

    const { data: file, error } = await supabase
      .from('wedding_files')
      .select('storage_path, file_name')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao buscar arquivo.')
    if (!file) return err(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado.')

    // `download` força Content-Disposition: attachment — sem isso, um arquivo com
    // mime_type de imagem/PDF abriria inline na aba, e depende só do allowlist do
    // bucket pra não ser um tipo renderizável/executável pelo browser.
    const { data: signed, error: signError } = await supabase.storage
      .from('wedding-files')
      .createSignedUrl(file.storage_path as string, SIGNED_URL_TTL_SECONDS, {
        download: file.file_name as string,
      })

    if (signError || !signed) return err(500, 'STORAGE_ERROR', 'Erro ao gerar link de download.')

    return ok({ url: signed.signedUrl })
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
      return err(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado.')
    }

    const { data: file, error: fetchError } = await supabase
      .from('wedding_files')
      .select('storage_path')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar arquivo.')
    if (!file) return err(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado.')

    // Apaga do storage antes do banco: se o storage falhar, o registro continua
    // consistente. Um objeto órfão no storage (banco sem apontar mais pra ele) é
    // menos grave que um registro no banco apontando pra um arquivo que não existe mais.
    const { error: storageError } = await supabase.storage
      .from('wedding-files')
      .remove([file.storage_path as string])

    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover arquivo do armazenamento.')

    const { data, error } = await supabase
      .from('wedding_files')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover registro do arquivo.')
    if (!data) return err(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
