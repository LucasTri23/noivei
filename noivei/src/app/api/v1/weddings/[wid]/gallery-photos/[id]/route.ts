import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateGalleryPhotoSchema } from '@/lib/api/validation/gallery-photo.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingGalleryPhoto } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

interface GalleryPhotoWithUrl extends WeddingGalleryPhoto {
  public_url: string
}

// PATCH mora num arquivo [id]/route.ts separado da rota de coleção (que usa storage_path
// via query string pro DELETE — ver comentário lá sobre por quê) porque aqui o client
// sempre tem o `id` disponível: quem chama já buscou a lista via GET, que inclui o id de
// cada registro. Só os campos de ajuste de recorte (position_y/fit_contain) são editáveis.
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateGalleryPhotoSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('wedding_gallery_photos')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar foto.')
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    const photo = data as WeddingGalleryPhoto
    const publicUrl = supabase.storage.from('wedding-photos').getPublicUrl(photo.storage_path).data.publicUrl

    return ok({ ...photo, public_url: publicUrl } as GalleryPhotoWithUrl)
  } catch (error) {
    return handleApiError(error)
  }
}
