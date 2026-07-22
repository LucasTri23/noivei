import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateGiftRegistryItemSchema } from '@/lib/api/validation/gift.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import {
  deleteGiftPhotoStorageObject,
  toGiftPhotoPublicUrl,
  verifyGiftPhotoStorageObject,
} from '@/lib/gifts/gift-photo-storage'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { GiftRegistryItem } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'presentes')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateGiftRegistryItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: existing, error: fetchError } = await supabase
      .from('gift_registry_items')
      .select('image_storage_path')
      .eq('id', id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao verificar o item.')
    if (!existing) return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')

    const previousStoragePath = existing.image_storage_path as string | null
    const update: Record<string, unknown> = { ...parsed.data }

    // Só reverifica/recobra cota quando o path de foto mudou de verdade — trocar só o
    // nome/preço com a mesma foto não deve custar uma verificação de Storage à toa.
    const replacingPhoto = 'image_storage_path' in parsed.data
      && parsed.data.image_storage_path
      && parsed.data.image_storage_path !== previousStoragePath

    if (replacingPhoto) {
      const imageSizeBytes = await verifyGiftPhotoStorageObject(supabase, wid, parsed.data.image_storage_path as string)
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

      update.image_size_bytes = imageSizeBytes
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .update(update)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar item da lista de presentes.')
    if (!data) return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')

    // Best-effort: remove a foto antiga do Storage só depois que a troca já foi
    // confirmada no banco — uma falha aqui deixa um objeto órfão, o que é menos grave
    // que apagar cedo demais e perder a foto se o UPDATE acima tivesse falhado.
    if (replacingPhoto && previousStoragePath) {
      await deleteGiftPhotoStorageObject(supabase, previousStoragePath)
    }

    const result = data as GiftRegistryItem
    const resolved = result.image_storage_path
      ? { ...result, image_url: toGiftPhotoPublicUrl(supabase, result.image_storage_path) }
      : result

    return ok(resolved)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, id } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'presentes')

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')
    }

    const { data, error } = await supabase
      .from('gift_registry_items')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id, image_storage_path')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover item da lista de presentes.')
    if (!data) return err(404, 'GIFT_NOT_FOUND', 'Item da lista de presentes não encontrado.')

    const storagePath = data.image_storage_path as string | null
    if (storagePath) await deleteGiftPhotoStorageObject(supabase, storagePath)

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
