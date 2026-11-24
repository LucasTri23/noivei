import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateGalleryPhotoSchema } from '@/lib/api/validation/gallery-photo.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit, resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { MONOGRAM_IMAGE_LIMITS, siteFeatureAccess } from '@/lib/site/customization'
import { resolveSiteTemplate } from '@/lib/site/templates'
import { GALLERY_PHOTO_LIMIT_BY_TEMPLATE } from '@/lib/site/template-limits'
import {
  deletePhotoRecordAfterStorage,
  getStoredObjectInfo,
  PHOTO_DELETE_INCOMPLETE_MESSAGE,
} from '@/lib/site/wedding-photo-storage'
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
      // Fotos da história têm rota própria. 'brand' (monograma) entra para o editor
      // saber o tamanho de cada arquivo na barra de armazenamento.
      .in('purpose', ['gallery', 'brand'])
      .order('created_at', { ascending: false })
      // Defesa em profundidade: a cota de armazenamento (compartilhada com Central de
      // arquivos) já limita o volume real; este teto só evita devolver a tabela inteira.
      .limit(1000)

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

    // Teto de fotos do estilo de site ATUAL (ver template-limits.ts) — cada template
    // tem a grade da galeria desenhada para uma quantidade controlada. Sem template
    // salvo ainda (site nunca configurado), trata como 'classic' (sem limite), mesmo
    // fallback usado em get-public-site-by-slug.ts.
    const { data: siteConfigRow } = await supabase
      .from('site_config')
      .select('template')
      .eq('wedding_id', wid)
      .maybeSingle()
    const planId = await resolveWeddingPlanId(supabase, wid)
    const template = siteConfigRow?.template ? resolveSiteTemplate(siteConfigRow.template, planId) : 'classic'
    const isBrand = parsed.data.purpose === 'brand'
    if (isBrand && !siteFeatureAccess(planId).monogram) {
      return err(403, 'MONOGRAM_NOT_AVAILABLE', 'O monograma está disponível a partir do plano Ideal.')
    }
    const galleryLimit = isBrand ? null : GALLERY_PHOTO_LIMIT_BY_TEMPLATE[template]

    if (galleryLimit !== null) {
      // Só fotos de galeria contam no teto do estilo — fotos da história
      // (purpose = 'story') têm teto próprio e não aparecem na galeria.
      const { count: currentPhotoCount, error: countError } = await supabase
        .from('wedding_gallery_photos')
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', wid)
        .eq('purpose', 'gallery')

      if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar limite de fotos da galeria.')

      if ((currentPhotoCount ?? 0) >= galleryLimit) {
        return err(
          403,
          'GALLERY_LIMIT_REACHED',
          `Este modelo de site aceita até ${galleryLimit} fotos na galeria. Remova uma foto antiga ou troque de modelo em Site do casal.`,
        )
      }
    }

    // `size_bytes` do body é o que o client alega, não o que foi de fato gravado no
    // Storage — sem conferir aqui, dava pra mentir um valor baixo e furar a cota do
    // plano indefinidamente. `list()` retorna os metadados reais do objeto gravado.
    const storedObject = await getStoredObjectInfo(supabase, wid, parsed.data.storage_path)
    if (!storedObject) {
      return err(400, 'VALIDATION_ERROR', 'Foto não encontrada no armazenamento. Envie novamente.')
    }

    const actualSizeBytes = storedObject.sizeBytes ?? parsed.data.size_bytes

    // Monograma: só imagem rasterizada (SVG no bucket público executaria script ao
    // ser aberto direto pela URL) e arquivo pequeno — o editor já reduz para 600px.
    if (isBrand && (!['image/png', 'image/webp', 'image/jpeg'].includes(storedObject.mimeType ?? '') || actualSizeBytes > MONOGRAM_IMAGE_LIMITS.maxFileBytes)) {
      await supabase.storage.from('wedding-photos').remove([parsed.data.storage_path])
      return err(400, 'INVALID_MONOGRAM_IMAGE', 'Envie o monograma em PNG, JPG ou WEBP, com até 2 MB.')
    }

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
      .insert({ ...parsed.data, purpose: isBrand ? 'brand' : 'gallery', size_bytes: actualSizeBytes, wedding_id: wid, uploaded_by: user.id })
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
      // Fotos da história são removidas pela rota própria (/story/photos/[id]).
      .in('purpose', ['gallery', 'brand'])
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar foto.')
    if (!photo) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    // Storage antes do banco — ver deletePhotoRecordAfterStorage.
    const { error: storageError } = await supabase.storage
      .from('wedding-photos')
      .remove([storagePath])

    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover foto do armazenamento.')

    const { data, error } = await deletePhotoRecordAfterStorage(() => supabase
      .from('wedding_gallery_photos')
      .delete()
      .eq('storage_path', storagePath)
      .eq('wedding_id', wid)
      .in('purpose', ['gallery', 'brand'])
      .select('id')
      .maybeSingle())

    if (error) return err(500, 'PHOTO_DELETE_INCOMPLETE', PHOTO_DELETE_INCOMPLETE_MESSAGE)
    if (!data) return err(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.')

    return ok({ storage_path: storagePath })
  } catch (error) {
    return handleApiError(error)
  }
}
