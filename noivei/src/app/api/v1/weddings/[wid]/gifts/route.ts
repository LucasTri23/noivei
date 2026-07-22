import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateGiftRegistryItemSchema } from '@/lib/api/validation/gift.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { toGiftPhotoPublicUrl, verifyGiftPhotoStorageObject } from '@/lib/gifts/gift-photo-storage'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GiftRegistryItem } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

function withResolvedImageUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  item:     GiftRegistryItem,
): GiftRegistryItem {
  if (!item.image_storage_path) return item
  return { ...item, image_url: toGiftPhotoPublicUrl(supabase, item.image_storage_path) }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'presentes')

    const { data, error } = await supabase
      .from('gift_registry_items')
      .select('*')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar itens da lista de presentes.')

    const items = ((data ?? []) as GiftRegistryItem[]).map((item) => withResolvedImageUrl(supabase, item))

    return ok(items)
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
    await requireModuleAccess(supabase, wid, user.id, 'presentes')

    const body = await parseJsonBody(req)
    const parsed = CreateGiftRegistryItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    let imageSizeBytes: number | null = null
    if (parsed.data.image_storage_path) {
      imageSizeBytes = await verifyGiftPhotoStorageObject(supabase, wid, parsed.data.image_storage_path)
      if (imageSizeBytes === null) {
        return err(400, 'VALIDATION_ERROR', 'Foto não encontrada no armazenamento. Envie novamente.')
      }

      const limitCheck = await checkStorageLimit(supabase, wid, imageSizeBytes)
      if (!limitCheck.allowed) {
        return err(403, 'STORAGE_LIMIT_EXCEEDED', 'Limite de armazenamento do seu plano atingido.', {
          current: limitCheck.current,
          limit:   limitCheck.limit,
        })
      }
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .insert({ ...parsed.data, image_size_bytes: imageSizeBytes, wedding_id: wid })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao criar item da lista de presentes.')

    return ok(withResolvedImageUrl(supabase, data as GiftRegistryItem), undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
