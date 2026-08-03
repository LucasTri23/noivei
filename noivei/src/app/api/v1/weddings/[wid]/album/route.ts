import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ wid: string }>
}

const SIGNED_URL_TTL_SECONDS = 60

export interface AlbumPhotoWithUrl {
  id:                        string
  size_bytes:                number
  mime_type:                 string
  created_at:                string
  contributor_name:          string | null
  contributor_relationship:  string | null
  url:                       string | null
}

// Lista as fotos submetidas pros convidados, com a legenda do contribuidor
// (nome + relação) e uma signed URL de 60s — o bucket "wedding-album-photos" não
// tem NENHUMA policy de storage pra authenticated (ver migration), então nem o
// time do casal lê o objeto direto: sempre via signed URL gerada aqui com
// service role, depois de já ter confirmado posse/permissão no banco.
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'album')

    const { data: photos, error } = await supabase
      .from('album_photos')
      .select('id, storage_path, size_bytes, mime_type, created_at, album_contributors(name, relationship)')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar fotos do álbum.')

    const serviceClient = createSupabaseService()
    const withUrls: AlbumPhotoWithUrl[] = await Promise.all(
      (photos ?? []).map(async (photo) => {
        const { data: signed } = await serviceClient.storage
          .from('wedding-album-photos')
          .createSignedUrl(photo.storage_path as string, SIGNED_URL_TTL_SECONDS)

        const contributor = photo.album_contributors as unknown as
          { name: string; relationship: string } | null

        return {
          id:                       photo.id as string,
          size_bytes:               photo.size_bytes as number,
          mime_type:                photo.mime_type as string,
          created_at:               photo.created_at as string,
          contributor_name:         contributor?.name ?? null,
          contributor_relationship: contributor?.relationship ?? null,
          url:                      signed?.signedUrl ?? null,
        }
      }),
    )

    return ok(withUrls)
  } catch (error) {
    return handleApiError(error)
  }
}
