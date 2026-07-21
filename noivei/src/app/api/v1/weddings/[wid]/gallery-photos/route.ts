import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateGalleryPhotoSchema } from '@/lib/api/validation/gallery-photo.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingGalleryPhoto } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

interface GalleryPhotoWithUrl extends WeddingGalleryPhoto {
  public_url: string
}

function toPublicUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  storagePath: string,
): string {
  return supabase.storage.from('wedding-photos').getPublicUrl(storagePath).data.publicUrl
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const { data, error } = await supabase
      .from('wedding_gallery_photos')
      .select('*')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar fotos da galeria.')

    const photos = ((data ?? []) as WeddingGalleryPhoto[]).map((photo) => ({
      ...photo,
      public_url: toPublicUrl(supabase, photo.storage_path),
    }))

    return ok(photos as GalleryPhotoWithUrl[])
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const body = await parseJsonBody(req)
    const parsed = CreateGalleryPhotoSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    // O upload dos bytes já aconteceu direto no Storage (client -> bucket); aqui só
    // registramos os metadados. O path precisa começar com o wedding_id porque é isso
    // que a policy de storage.objects usa para checar posse do arquivo.
    if (!parsed.data.storage_path.startsWith(`${wid}/`)) {
      return err(400, 'VALIDATION_ERROR', 'Caminho de armazenamento inválido para este casamento.')
    }

    // `size_bytes` do body é o que o client alega, não o que foi de fato gravado no
    // Storage — sem conferir aqui, dava pra mentir um valor baixo e furar a cota do
    // plano indefinidamente. `list()` retorna os metadados reais do objeto gravado.
    const objectName = parsed.data.storage_path.slice(wid.length + 1)
    const { data: listing, error: listError } = await supabase.storage
      .from('wedding-photos')
      .list(wid, { search: objectName })

    const storedObject = listing?.find((item) => item.name === objectName)
    if (listError || !storedObject) {
      return err(400, 'VALIDATION_ERROR', 'Foto não encontrada no armazenamento. Envie novamente.')
    }

    const actualSizeBytes = (storedObject.metadata?.size as number | undefined) ?? parsed.data.size_bytes

    // Mesma cota da Central de arquivos (checkStorageLimit soma wedding_files +
    // wedding_gallery_photos) — não é um pool de armazenamento separado.
    const limitCheck = await checkStorageLimit(supabase, wid, actualSizeBytes)
    if (!limitCheck.allowed) {
      return err(403, 'STORAGE_LIMIT_EXCEEDED', 'Limite de armazenamento do seu plano atingido.', {
        current: limitCheck.current,
        limit:   limitCheck.limit,
      })
    }

    const { data, error } = await supabase
      .from('wedding_gallery_photos')
      .insert({ ...parsed.data, size_bytes: actualSizeBytes, wedding_id: wid, uploaded_by: user.id })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao registrar foto.')

    const photo = data as WeddingGalleryPhoto
    return ok({ ...photo, public_url: toPublicUrl(supabase, photo.storage_path) } as GalleryPhotoWithUrl, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE fica na rota de coleção (em vez de um `[id]/route.ts`) porque o único dado que o
// `GaleriaSection` tem disponível ao remover uma URL da lista é a própria URL pública — e
// `storage_path` (derivado dela) contém barras, então não dá pra usá-lo como um segmento
// de rota dinâmico `[id]`. Recebe `storage_path` via query string e localiza o registro
// por ele, escopado ao wedding_id (RLS/ownership já garante que não vaza outro casamento).
export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const storagePath = new URL(req.url).searchParams.get('storage_path')
    if (!storagePath || !storagePath.startsWith(`${wid}/`)) {
      return err(400, 'VALIDATION_ERROR', 'Caminho de armazenamento inválido para este casamento.')
    }

    const { data: photo, error: fetchError } = await supabase
      .from('wedding_gallery_photos')
      .select('storage_path')
      .eq('storage_path', storagePath)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar foto.')
    if (!photo) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    // Apaga do storage antes do banco: se o storage falhar, o registro continua
    // consistente. Um objeto órfão no storage (banco sem apontar mais pra ele) é
    // menos grave que um registro no banco apontando pra uma foto que não existe mais.
    const { error: storageError } = await supabase.storage
      .from('wedding-photos')
      .remove([storagePath])

    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover foto do armazenamento.')

    const { data, error } = await supabase
      .from('wedding_gallery_photos')
      .delete()
      .eq('storage_path', storagePath)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover registro da foto.')
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    return ok({ storage_path: storagePath })
  } catch (error) {
    return handleApiError(error)
  }
}
