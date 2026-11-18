import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateStoryPhotoSchema } from '@/lib/api/validation/site-story.schema'
import { momentBelongsToWedding, requireStoryAccess, storyDbErrorResponse } from '@/lib/site/story/story-api'
import {
  deletePhotoRecordAfterStorage,
  PHOTO_DELETE_INCOMPLETE_MESSAGE,
  WEDDING_PHOTOS_BUCKET,
} from '@/lib/site/wedding-photo-storage'
import type { SiteStoryPhoto } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { wid, id } = await params
    const { supabase } = await requireStoryAccess(wid)
    if (!UuidSchema.safeParse(id).success) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    const parsed = UpdateStoryPhotoSchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    if (parsed.data.moment_id && !(await momentBelongsToWedding(supabase, wid, parsed.data.moment_id))) {
      return err(400, 'INVALID_MOMENT', 'O momento escolhido não pertence a este casamento.')
    }

    const { data, error } = await supabase
      .from('site_story_photos')
      .update(parsed.data)
      .eq('photo_id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return storyDbErrorResponse(error, 'Erro ao atualizar foto da história.')
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')
    return ok(data as SiteStoryPhoto)
  } catch (error) {
    return handleApiError(error)
  }
}

// Storage ANTES do banco (ver deletePhotoRecordAfterStorage). Apagar a linha
// de wedding_gallery_photos remove os metadados da história em cascata.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { wid, id } = await params
    const { supabase } = await requireStoryAccess(wid)
    if (!UuidSchema.safeParse(id).success) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    const { data: photo, error: fetchError } = await supabase
      .from('wedding_gallery_photos')
      .select('storage_path')
      .eq('id', id)
      .eq('wedding_id', wid)
      .eq('purpose', 'story')
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar foto.')
    if (!photo) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    const storagePath = photo.storage_path as string
    const { error: storageError } = await supabase.storage.from(WEDDING_PHOTOS_BUCKET).remove([storagePath])
    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover foto do armazenamento.')

    const { data, error } = await deletePhotoRecordAfterStorage(() => supabase
      .from('wedding_gallery_photos')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .eq('purpose', 'story')
      .select('id')
      .maybeSingle())

    if (error) return err(500, 'PHOTO_DELETE_INCOMPLETE', PHOTO_DELETE_INCOMPLETE_MESSAGE)
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')
    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
