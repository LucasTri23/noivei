import type { SupabaseClient } from '@supabase/supabase-js'

export const WEDDING_PHOTOS_BUCKET = 'wedding-photos'

export interface StoredObjectInfo {
  sizeBytes: number | null
  mimeType:  string | null
}

/** URL pública de um objeto do bucket "wedding-photos" (bucket público). */
export function toWeddingPhotoPublicUrl(supabase: SupabaseClient, storagePath: string): string {
  return supabase.storage.from(WEDDING_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/** O path precisa começar com o wedding_id — é o que as policies de storage.objects usam para checar posse. */
export function isWeddingStoragePath(weddingId: string, storagePath: string): boolean {
  const rest = storagePath.slice(weddingId.length + 1)
  return storagePath.startsWith(`${weddingId}/`) && rest.length > 0 && !rest.includes('/') && !rest.includes('..')
}

interface DbResult<T> {
  data:  T | null
  error: unknown
}

/**
 * Remoção do registro de uma foto cujo arquivo JÁ saiu do Storage. O Storage
 * vem primeiro porque o bucket é público: apagar o registro antes deixaria um
 * arquivo acessível pela URL e sem nenhum registro para removê-lo depois.
 * Uma falha aqui deixa o registro apontando para um arquivo inexistente, então
 * tenta de novo uma vez; se ainda falhar, a rota responde
 * PHOTO_DELETE_INCOMPLETE e repetir a exclusão resolve (remover um objeto que
 * não existe mais não é erro no Storage).
 */
export async function deletePhotoRecordAfterStorage<T>(run: () => PromiseLike<DbResult<T>>): Promise<DbResult<T>> {
  const first = await run()
  return first.error ? run() : first
}

export const PHOTO_DELETE_INCOMPLETE_MESSAGE =
  'O arquivo foi removido, mas não conseguimos concluir a exclusão. Tente excluir a foto novamente.'

/**
 * Metadados reais do objeto gravado no Storage — nunca confiar no tamanho/tipo
 * que o client alega (dava para furar a cota informando um tamanho menor).
 * null = objeto não existe (ou não pôde ser listado).
 */
export async function getStoredObjectInfo(
  supabase:    SupabaseClient,
  weddingId:   string,
  storagePath: string,
): Promise<StoredObjectInfo | null> {
  const objectName = storagePath.slice(weddingId.length + 1)
  const { data: listing, error } = await supabase.storage
    .from(WEDDING_PHOTOS_BUCKET)
    .list(weddingId, { search: objectName })

  const stored = listing?.find((item) => item.name === objectName)
  if (error || !stored) return null

  return {
    sizeBytes: (stored.metadata?.size as number | undefined) ?? null,
    mimeType:  (stored.metadata?.mimetype as string | undefined) ?? null,
  }
}
