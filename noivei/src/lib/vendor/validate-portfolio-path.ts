const OBJECT_NAME_PATTERN = /^[a-zA-Z0-9.\-_]{1,200}$/

const EXTENSION_TO_MIME: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
}

export interface PortfolioPathValidation {
  valid:   boolean
  reason?: 'invalid_characters' | 'invalid_extension' | 'extension_mime_mismatch'
}

/**
 * Revalida no servidor o nome do objeto dentro do storage_path — nunca confia que o
 * client de fato usou sanitizeFileName() (src/lib/files/upload-wedding-file.ts) antes
 * de subir pro Storage: o client pode chamar supabase.storage.upload() com qualquer
 * nome autenticado, o objeto só precisa começar com o próprio vendor_id pra passar
 * pela RLS do bucket (fn_owns_vendor). Reforça, no servidor: charset seguro (mesmo
 * alfabeto de sanitizeFileName), extensão dentre as permitidas, e extensão batendo
 * com o MIME real reportado pelo Storage — defesa extra contra spoofing além da
 * checagem de metadata.mimetype já feita na Route Handler.
 */
export function validatePortfolioObjectName(objectName: string, actualMimeType: string): PortfolioPathValidation {
  if (!OBJECT_NAME_PATTERN.test(objectName)) {
    return { valid: false, reason: 'invalid_characters' }
  }

  const extension = objectName.split('.').pop()?.toLowerCase() ?? ''
  const expectedMime = EXTENSION_TO_MIME[extension]

  if (!expectedMime) {
    return { valid: false, reason: 'invalid_extension' }
  }

  if (expectedMime !== actualMimeType) {
    return { valid: false, reason: 'extension_mime_mismatch' }
  }

  return { valid: true }
}

export const MAX_VENDOR_PORTFOLIO_ITEMS = 30
