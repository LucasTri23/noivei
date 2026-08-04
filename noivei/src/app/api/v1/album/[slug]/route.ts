import { ok, err, handleApiError } from '@/lib/api/response'
import { AlbumSlugSchema } from '@/lib/api/validation/album.schema'
import { getAlbumBySlug } from '@/lib/album/get-album-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ slug: string }>
}

// Rota pública (sem auth): o slug é o mesmo do site público do casal
// (site_config.slug) — o mural só existe pra quem já publicou o site. Ao
// contrário de register/photos/gallery, aqui module_enabled=false NÃO vira o
// mesmo 404 genérico de slug inexistente — a página pública usa esse campo
// pra mostrar "recurso não disponível" em vez de "mural não encontrado" (ver
// getAlbumBySlug).
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params

    const parsedSlug = AlbumSlugSchema.safeParse(decodeURIComponent(slug))
    if (!parsedSlug.success) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const supabase = createSupabaseService()
    const album = await getAlbumBySlug(supabase, parsedSlug.data)

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
