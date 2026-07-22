import type { SupabaseClient } from '@supabase/supabase-js'

export const GIFT_PHOTOS_BUCKET = 'wedding-gift-photos'

/** Deriva a URL pública a partir do storage_path — nunca confia num image_url gravado
 * pra foto enviada do dispositivo, mesmo padrão de toPublicUrl() em gallery-photos. */
export function toGiftPhotoPublicUrl(supabase: SupabaseClient, storagePath: string): string {
  return supabase.storage.from(GIFT_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/**
 * Confere que o objeto existe no bucket e retorna o tamanho REAL gravado no Storage —
 * nunca confia no `size_bytes` que o client alega, senão dava pra mentir um valor baixo
 * e furar a cota de armazenamento do plano (mesmo motivo de gallery-photos/route.ts).
 * Retorna null se o path não pertence a este casamento ou o objeto não existe.
 */
export async function verifyGiftPhotoStorageObject(
  supabase:    SupabaseClient,
  weddingId:   string,
  storagePath: string,
): Promise<number | null> {
  if (!storagePath.startsWith(`${weddingId}/`)) return null

  const objectName = storagePath.slice(weddingId.length + 1)
  const { data: listing } = await supabase.storage
    .from(GIFT_PHOTOS_BUCKET)
    .list(weddingId, { search: objectName })

  const storedObject = listing?.find((item) => item.name === objectName)
  if (!storedObject) return null

  return (storedObject.metadata?.size as number | undefined) ?? null
}

/** Best-effort: remove o objeto antigo do Storage ao trocar/apagar a foto de um item. */
export async function deleteGiftPhotoStorageObject(supabase: SupabaseClient, storagePath: string): Promise<void> {
  await supabase.storage.from(GIFT_PHOTOS_BUCKET).remove([storagePath])
}
