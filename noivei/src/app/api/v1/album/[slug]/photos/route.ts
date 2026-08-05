import { ok, err, handleApiError } from '@/lib/api/response'
import { AlbumSlugSchema } from '@/lib/api/validation/album.schema'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { getAlbumBySlug } from '@/lib/album/get-album-by-slug'
import { isAlbumUploadWindowOpen } from '@/lib/album/wedding-day'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ slug: string }>
}

// Mesmo teto do bucket "wedding-album-photos" (ver migration) — checado de novo
// aqui pra devolver um erro claro ANTES de tentar o upload, em vez de depender
// só do allowed_mime_types/file_size_limit do Storage como única linha de defesa.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']

// Teto bruto de fotos por casamento, independente da cota de armazenamento do
// plano — defesa deliberada de abuso pra uma superfície 100% anônima: sem
// isso, um ataque conseguiria inundar o álbum de milhares de fotos minúsculas
// mesmo respeitando a cota de bytes do plano.
const MAX_PHOTOS_PER_WEDDING = 500

// NFKD decompõe acentos em letra base + diacrítico; o replace seguinte derruba
// tanto os diacríticos quanto qualquer caractere fora de [a-zA-Z0-9.-_] — mesmo
// sanitizador usado em file-archive-manager.tsx pro nome virar path no bucket.
function sanitizeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9.\-_]/g, '-')
}

// Rota pública (sem auth): o upload é sempre PROXIED por aqui com service role
// — não existe sessão de storage.objects pro visitante anônimo (ver migration:
// bucket sem NENHUMA policy pra anon/authenticated).
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params

    const parsedSlug = AlbumSlugSchema.safeParse(decodeURIComponent(slug))
    if (!parsedSlug.success) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    const supabase = createSupabaseService()

    const ipLimit = await checkRateLimit(supabase, `album-photo:ip:${getClientIp(req)}`, 20, 3600)
    if (!ipLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const album = await getAlbumBySlug(supabase, parsedSlug.data)
    // Mesmo erro genérico de slug inexistente — ver register/route.ts.
    if (!album || !album.moduleEnabled) {
      return err(404, 'ALBUM_NOT_FOUND', 'Mural não encontrado.')
    }

    // Nunca confia no client pra isso: mesmo que a UI só mostre o formulário
    // dentro da janela (dia do casamento + dia seguinte), alguém poderia
    // chamar esta rota direto fora dela (antes ou depois) com um
    // contributor_id capturado antes.
    if (!isAlbumUploadWindowOpen(album.weddingDate)) {
      return err(403, 'NOT_WEDDING_DAY', 'O mural só recebe fotos no dia do casamento e no dia seguinte.')
    }

    const weddingLimit = await checkRateLimit(supabase, `album-photo:wedding:${album.weddingId}`, 300, 3600)
    if (!weddingLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return err(400, 'INVALID_BODY', 'Corpo da requisição inválido.')
    }

    const file = formData.get('file')
    const contributorIdRaw = formData.get('contributor_id')

    if (!(file instanceof File)) {
      return err(400, 'VALIDATION_ERROR', 'Envie uma foto.')
    }

    const parsedContributorId = UuidSchema.safeParse(contributorIdRaw)
    if (!parsedContributorId.success) {
      return err(400, 'VALIDATION_ERROR', 'Cadastre-se antes de enviar fotos.')
    }

    // Confirma que o contributor_id pertence a ESTE casamento (o resolvido pelo
    // slug) — sem isso, alguém poderia reusar um contributor_id capturado no
    // cadastro de OUTRO casamento pra enviar fotos aqui.
    const { data: contributor, error: contributorError } = await supabase
      .from('album_contributors')
      .select('id')
      .eq('id', parsedContributorId.data)
      .eq('wedding_id', album.weddingId)
      .maybeSingle()

    if (contributorError) return err(500, 'DB_ERROR', 'Erro ao verificar cadastro.')
    if (!contributor) {
      return err(404, 'CONTRIBUTOR_NOT_FOUND', 'Cadastro não encontrado. Cadastre-se novamente.')
    }

    // Nunca confia no mime/tamanho que o client alega — checa de novo aqui
    // antes de qualquer chamada ao Storage.
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return err(400, 'INVALID_FILE_TYPE', 'Envie apenas fotos (PNG, JPEG, WEBP ou HEIC).')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return err(400, 'FILE_TOO_LARGE', 'A foto deve ter no máximo 4 MB.')
    }

    const { count: photoCount, error: countError } = await supabase
      .from('album_photos')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', album.weddingId)

    if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar o mural.')
    if ((photoCount ?? 0) >= MAX_PHOTOS_PER_WEDDING) {
      return err(403, 'ALBUM_PHOTO_LIMIT_REACHED', 'Este mural já atingiu o limite de fotos.')
    }

    const limitCheck = await checkStorageLimit(supabase, album.weddingId, file.size)
    if (!limitCheck.allowed) {
      return err(403, 'STORAGE_LIMIT_EXCEEDED', 'O armazenamento deste casamento está cheio no momento.')
    }

    const storagePath = `${album.weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from('wedding-album-photos')
      .upload(storagePath, file, { contentType: file.type })

    if (uploadError) return err(500, 'STORAGE_ERROR', 'Erro ao enviar a foto. Tente novamente.')

    const { data: photo, error: insertError } = await supabase
      .from('album_photos')
      .insert({
        wedding_id:     album.weddingId,
        contributor_id: parsedContributorId.data,
        storage_path:   storagePath,
        size_bytes:     file.size,
        mime_type:      file.type,
      })
      .select('id')
      .single()

    if (insertError) {
      // O upload já subiu pro storage; sem o registro no banco ele fica órfão — remove.
      await supabase.storage.from('wedding-album-photos').remove([storagePath])
      return err(500, 'DB_ERROR', 'Erro ao registrar a foto.')
    }

    return ok({ id: photo.id as string }, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
