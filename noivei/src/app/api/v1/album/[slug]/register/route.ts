import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { AlbumSlugSchema, RegisterContributorSchema } from '@/lib/api/validation/album.schema'
import { getAlbumBySlug } from '@/lib/album/get-album-by-slug'
import { isAlbumUploadWindowOpen } from '@/lib/album/wedding-day'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ slug: string }>
}

// Rota pública (sem auth): qualquer visitante do casamento pode se cadastrar,
// sem conta real (nunca chama auth.signUp — é só uma linha em album_contributors).
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params

    const parsedSlug = AlbumSlugSchema.safeParse(decodeURIComponent(slug))
    if (!parsedSlug.success) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const supabase = createSupabaseService()

    // Rate limit por IP (uma origem não deve conseguir cadastrar centenas de
    // contribuidores falsos) E por slug (uma festa de verdade pode ter
    // centenas de convidados se cadastrando ao mesmo tempo pelo mesmo QR — o
    // limite por slug precisa ser bem mais generoso que o de IP).
    const ipLimit = await checkRateLimit(supabase, `album-register:ip:${getClientIp(req)}`, 10, 3600)
    if (!ipLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }
    const slugLimit = await checkRateLimit(supabase, `album-register:slug:${parsedSlug.data}`, 200, 3600)
    if (!slugLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const album = await getAlbumBySlug(supabase, parsedSlug.data)
    // Slug inexistente e módulo desabilitado devolvem o MESMO erro genérico —
    // diferente da rota GET pública, aqui não dá pra diferenciar "casamento não
    // existe" de "recurso não contratado neste plano".
    if (!album || !album.moduleEnabled) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    // Cadastro só é aceito no dia do casamento ou no dia seguinte — sem isso,
    // alguém poderia se cadastrar dias antes e só descobrir na hora do upload
    // (POST photos, que faz a mesma checagem) que não vai conseguir postar nada.
    if (!isAlbumUploadWindowOpen(album.weddingDate)) {
      return err(403, 'NOT_WEDDING_DAY', 'O mural só recebe fotos no dia do casamento e no dia seguinte.')
    }

    const body = await parseJsonBody(req)
    const parsed = RegisterContributorSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('album_contributors')
      .insert({ ...parsed.data, wedding_id: album.weddingId })
      .select('id')
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao cadastrar. Tente novamente.')

    return ok({ contributor_id: data.id as string }, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
