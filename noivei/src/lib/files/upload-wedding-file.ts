import { createSupabaseBrowser } from '@/lib/supabase/browser'
import type { WeddingFile, WeddingFileCategory } from '@/types/database'

// NFKD decompõe acentos em letra base + diacrítico; o replace seguinte já derruba
// tanto os diacríticos quanto qualquer outro caractere fora de [a-zA-Z0-9.-_] — o
// nome sanitizado vira parte do path no bucket, que não aceita espaços/acentos.
export function sanitizeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9.\-_]/g, '-')
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

export interface UploadWeddingFileResult {
  file?:  WeddingFile
  error?: string
}

/**
 * Sobe um arquivo pro bucket "wedding-files" e registra os metadados via
 * `POST /api/v1/weddings/{weddingId}/files` — mesmo fluxo usado pela Central de
 * Arquivos (upload direto pro Storage, depois registro dos metadados), reaproveitado
 * aqui para qualquer outro lugar do app que precise anexar um arquivo a um casamento
 * (ex.: anexo de lançamento financeiro). Não duplica a validação de MIME/tamanho real
 * gravado no Storage nem a checagem de cota (checkStorageLimit) — ambas continuam
 * vivendo só na Route Handler, este helper só orquestra o upload + registro do lado
 * do client, igual ao que `file-archive-manager.tsx` já fazia antes deste helper existir.
 */
export async function uploadWeddingFile(
  weddingId: string,
  file:      File,
  category:  WeddingFileCategory = 'geral',
): Promise<UploadWeddingFileResult> {
  const path = `${weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const supabase = createSupabaseBrowser()

  const { error: uploadError } = await supabase.storage.from('wedding-files').upload(path, file)
  if (uploadError) {
    return { error: `Não foi possível enviar "${file.name}". Verifique o tamanho (máx. 50 MB) e tente novamente.` }
  }

  const res = await fetch(`/api/v1/weddings/${weddingId}/files`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name:    file.name,
      storage_path: path,
      size_bytes:   file.size,
      mime_type:    file.type || null,
      category,
    }),
  })

  if (!res.ok) {
    // O upload já subiu pro storage; sem o registro de metadados ele fica órfão — remove.
    await supabase.storage.from('wedding-files').remove([path])
    return { error: `"${file.name}": ${await readApiError(res, 'Não foi possível salvar o arquivo.')}` }
  }

  const { data } = (await res.json()) as { data: WeddingFile }
  return { file: data }
}
