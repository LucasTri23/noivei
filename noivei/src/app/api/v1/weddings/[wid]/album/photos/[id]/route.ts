import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

// Moderação/curadoria do casal: remove uma foto enviada por um convidado.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'album')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')
    }

    const { data: photo, error: fetchError } = await supabase
      .from('album_photos')
      .select('storage_path')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar foto.')
    if (!photo) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    // Bucket sem policy nenhuma pra authenticated (ver migration) — remover o
    // objeto exige service role, mesmo já tendo confirmado posse/permissão acima.
    const serviceClient = createSupabaseService()
    const { error: storageError } = await serviceClient.storage
      .from('wedding-album-photos')
      .remove([photo.storage_path as string])

    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover foto do armazenamento.')

    const { data, error } = await supabase
      .from('album_photos')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover registro da foto.')
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
