'use client'

import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError } from '@/store/toast.store'

// Marcador do endpoint público do bucket "wedding-photos" — presente numa URL indica que
// ela veio de um upload (não de uma URL externa colada manualmente), e o que vem depois
// dele é o storage_path do objeto, usado pra localizar o registro na hora de excluir.
const GALLERY_BUCKET_URL_MARKER = '/storage/v1/object/public/wedding-photos/'

export interface GalleryPhotoRecord {
  id:           string
  storage_path: string
  size_bytes:   number
  position_y:   number
  fit_contain:  boolean
  public_url:   string
}

/** Ajuste de recorte de uma foto enviada do computador (indexado pela URL pública). */
export interface GalleryPhotoMeta {
  id:          string
  position_y:  number
  fit_contain: boolean
}

export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function sanitizeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9.\-_]/g, '-')
}

export function isUploadedPhotoUrl(url: string): boolean {
  return url.includes(GALLERY_BUCKET_URL_MARKER)
}

export async function listSitePhotos(weddingId: string): Promise<GalleryPhotoRecord[] | null> {
  try {
    const res = await fetch(`/api/v1/weddings/${weddingId}/gallery-photos`)
    if (!res.ok) return null
    return ((await res.json()) as { data: GalleryPhotoRecord[] }).data
  } catch {
    return null
  }
}

/**
 * Sobe os bytes direto pro Storage e registra os metadados via API (o que soma a foto
 * na cota de armazenamento do plano). A foto só passa a aparecer no site quando o
 * rascunho que a usa for salvo.
 */
export async function uploadSitePhoto(weddingId: string, file: File): Promise<GalleryPhotoRecord | null> {
  const path = `${weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const supabase = createSupabaseBrowser()

  const { error: uploadError } = await supabase.storage.from('wedding-photos').upload(path, file)
  if (uploadError) {
    toastError(`Não foi possível enviar "${file.name}". Verifique o tamanho (máx. 8 MB) e o formato (PNG, JPG, WEBP, HEIC ou GIF).`)
    return null
  }

  const res = await fetch(`/api/v1/weddings/${weddingId}/gallery-photos`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ storage_path: path, size_bytes: file.size, mime_type: file.type || null }),
  })

  if (!res.ok) {
    // O upload já subiu pro storage; sem o registro de metadados ele fica órfão — remove.
    await supabase.storage.from('wedding-photos').remove([path])
    toastError(await readApiError(res, 'Não foi possível salvar a foto.'))
    return null
  }

  return ((await res.json()) as { data: GalleryPhotoRecord }).data
}

/** Remove do armazenamento uma foto enviada pelo editor. URLs externas são ignoradas. */
export async function deleteSitePhoto(weddingId: string, url: string): Promise<boolean> {
  const markerIndex = url.indexOf(GALLERY_BUCKET_URL_MARKER)
  if (markerIndex === -1) return true

  const storagePath = url.slice(markerIndex + GALLERY_BUCKET_URL_MARKER.length)
  try {
    const res = await fetch(
      `/api/v1/weddings/${weddingId}/gallery-photos?storage_path=${encodeURIComponent(storagePath)}`,
      { method: 'DELETE' },
    )
    return res.ok
  } catch {
    return false
  }
}

export async function patchSitePhotoMeta(weddingId: string, meta: GalleryPhotoMeta): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/weddings/${weddingId}/gallery-photos/${meta.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ position_y: meta.position_y, fit_contain: meta.fit_contain }),
    })
    return res.ok
  } catch {
    return false
  }
}
