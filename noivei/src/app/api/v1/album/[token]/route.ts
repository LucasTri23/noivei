import { ok, err, handleApiError } from '@/lib/api/response'
import { AlbumTokenSchema } from '@/lib/api/validation/album.schema'
import { getAlbumByToken } from '@/lib/album/get-album-by-token'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ token: string }>
}

// Rota pública (sem auth): o album_token é a credencial. Ao contrário de
// register/photos, aqui module_enabled=false NÃO vira o mesmo 404 genérico de
// token inexistente — a página pública usa esse campo pra mostrar "recurso não
// disponível" em vez de "mural não encontrado" (ver getAlbumByToken).
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { token } = await params

    const parsedToken = AlbumTokenSchema.safeParse(decodeURIComponent(token))
    if (!parsedToken.success) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const supabase = createSupabaseService()
    const album = await getAlbumByToken(supabase, parsedToken.data)

    if (!album) return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')

    return ok({
      couple_names:             album.coupleNames,
      wedding_color:            album.weddingColor,
      wedding_color_secondary:  album.weddingColorSecondary,
      module_enabled:           album.moduleEnabled,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
