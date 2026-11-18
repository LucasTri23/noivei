import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateStoryPhotoSchema, STORY_PHOTO_MIME_TYPES } from '@/lib/api/validation/site-story.schema'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { STORY_LIMITS } from '@/lib/site/story/story-limits'
import { momentBelongsToWedding, requireStoryAccess, storyDbErrorResponse } from '@/lib/site/story/story-api'
import {
  WEDDING_PHOTOS_BUCKET,
  getStoredObjectInfo,
  isWeddingStoragePath,
  toWeddingPhotoPublicUrl,
} from '@/lib/site/wedding-photo-storage'
import type { StoryPhotoRecord } from '@/lib/site/story/load-story'

interface RouteContext {
  params: Promise<{ wid: string }>
}

// Registra uma foto da história depois do upload direto ao Storage (mesmo fluxo
// da galeria). Qualquer recusa depois do upload remove o objeto, para não
// deixar arquivo órfão ocupando a cota do casal.
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { wid } = await params
    const { supabase } = await requireStoryAccess(wid)

    const parsed = CreateStoryPhotoSchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const input = parsed.data
    if (!isWeddingStoragePath(wid, input.storage_path)) {
      return err(400, 'VALIDATION_ERROR', 'Caminho de armazenamento inválido para este casamento.')
    }

    const discard = async () => {
      await supabase.storage.from(WEDDING_PHOTOS_BUCKET).remove([input.storage_path])
    }

    const stored = await getStoredObjectInfo(supabase, wid, input.storage_path)
    if (!stored) return err(400, 'VALIDATION_ERROR', 'Foto não encontrada no armazenamento. Envie novamente.')

    // Tipo e tamanho REAIS do objeto, não os declarados pelo client.
    const mimeType = stored.mimeType ?? input.mime_type
    const sizeBytes = stored.sizeBytes ?? input.size_bytes
    if (!(STORY_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) {
      await discard()
      return err(400, 'INVALID_FILE_TYPE', 'Envie fotos em JPG, PNG ou WEBP.')
    }
    if (sizeBytes > STORY_LIMITS.maxFileBytes) {
      await discard()
      return err(400, 'FILE_TOO_LARGE', 'Cada foto pode ter no máximo 8 MB.')
    }

    if (input.moment_id && !(await momentBelongsToWedding(supabase, wid, input.moment_id))) {
      await discard()
      return err(400, 'INVALID_MOMENT', 'O momento escolhido não pertence a este casamento.')
    }

    // Fotos da história somam na mesma cota de armazenamento do plano.
    const limitCheck = await checkStorageLimit(supabase, wid, sizeBytes)
    if (!limitCheck.allowed) {
      await discard()
      return err(403, 'STORAGE_LIMIT_EXCEEDED', 'Limite de armazenamento do seu plano atingido.', {
        current: limitCheck.current,
        limit:   limitCheck.limit,
      })
    }

    // Foto + metadados numa transação só (teto de 24 e FK do momento no banco).
    const { data: photoId, error } = await supabase.rpc('fn_add_site_story_photo', {
      p_wedding_id:   wid,
      p_storage_path: input.storage_path,
      p_size_bytes:   sizeBytes,
      p_mime_type:    mimeType,
      p_width:        input.width ?? null,
      p_height:       input.height ?? null,
      p_caption:      input.caption ?? null,
      p_moment_id:    input.moment_id ?? null,
    })

    if (error || !photoId) {
      await discard()
      return storyDbErrorResponse(error ?? {}, 'Erro ao registrar foto da história.')
    }

    const { data: meta } = await supabase
      .from('site_story_photos')
      .select('sort_order')
      .eq('photo_id', photoId as string)
      .maybeSingle()

    const record: StoryPhotoRecord = {
      id:           photoId as string,
      url:          toWeddingPhotoPublicUrl(supabase, input.storage_path),
      storage_path: input.storage_path,
      size_bytes:   sizeBytes,
      caption:      input.caption ?? null,
      moment_id:    input.moment_id ?? null,
      sort_order:   (meta?.sort_order as number | undefined) ?? 0,
      width:        input.width ?? null,
      height:       input.height ?? null,
      position_y:   50,
      fit_contain:  false,
    }
    return ok(record, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
