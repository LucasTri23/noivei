import { ok, err, handleApiError } from '@/lib/api/response'
import { AlbumSlugSchema } from '@/lib/api/validation/album.schema'
import { getAlbumBySlug } from '@/lib/album/get-album-by-slug'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ slug: string }>
}

// Mesmo teto de exibição usado na gestão autenticada (ver GET
// /api/v1/weddings/[wid]/album) — mais que isso deixaria de fazer sentido
// como "mural" de qualquer forma.
const GALLERY_PHOTO_LIMIT = 500

// TTL bem maior que o da gestão autenticada (60s): lá é uma grade que o casal
// abre, olha e fecha; aqui é uma página pública que um convidado pode deixar
// aberta rolando por alguns minutos no salão, em conexão de celular mais
// lenta. 8 minutos dá folga suficiente pra carregar/rolar a grade toda sem
// que as URLs expirem no meio da visita, sem chegar perto de virar um link
// "permanente" — a cada novo GET (ex: refresh periódico no client) as URLs
// são todas regeradas do zero.
const SIGNED_URL_TTL_SECONDS = 8 * 60

export interface PublicAlbumPhoto {
  id:  string
  url: string | null
}

// Rota pública (sem auth): mostra a TODOS os visitantes do mural (não só a
// quem já se cadastrou) as fotos já enviadas por qualquer convidado deste
// casamento — é a galeria compartilhada e "ao vivo" do mural. De propósito
// NÃO devolve nome/relação do contribuidor (diferente da tela de gestão
// autenticada, ver AlbumPhotoWithUrl): esta é a única leitura de dados do
// álbum acessível por qualquer pessoa com o link, sem cadastro nenhum, então
// minimiza o que expõe.
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params

    const parsedSlug = AlbumSlugSchema.safeParse(decodeURIComponent(slug))
    if (!parsedSlug.success) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const supabase = createSupabaseService()

    // Mais um ponto de leitura pública/anônima — mesma disciplina de rate
    // limit por IP e por casamento já aplicada em register/photos.
    const ipLimit = await checkRateLimit(supabase, `album-gallery:ip:${getClientIp(req)}`, 120, 3600)
    if (!ipLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const album = await getAlbumBySlug(supabase, parsedSlug.data)
    // Mesmo erro genérico de slug inexistente — ver register/route.ts. Módulo
    // desabilitado não pode ser diferenciado de slug inexistente aqui.
    if (!album || !album.moduleEnabled) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const weddingLimit = await checkRateLimit(supabase, `album-gallery:wedding:${album.weddingId}`, 3000, 3600)
    if (!weddingLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const { data: photos, error } = await supabase
      .from('album_photos')
      .select('id, storage_path, created_at')
      .eq('wedding_id', album.weddingId)
      .order('created_at', { ascending: false })
      .limit(GALLERY_PHOTO_LIMIT)

    if (error) return err(500, 'DB_ERROR', 'Erro ao carregar o mural.')

    const withUrls: PublicAlbumPhoto[] = await Promise.all(
      (photos ?? []).map(async (photo) => {
        const { data: signed } = await supabase.storage
          .from('wedding-album-photos')
          .createSignedUrl(photo.storage_path as string, SIGNED_URL_TTL_SECONDS)

        return { id: photo.id as string, url: signed?.signedUrl ?? null }
      }),
    )

    return ok(withUrls)
  } catch (error) {
    return handleApiError(error)
  }
}
