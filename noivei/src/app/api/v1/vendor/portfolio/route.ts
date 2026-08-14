import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateVendorPortfolioItemSchema } from '@/lib/api/validation/vendor.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorPortfolioItem } from '@/types/database'

// Mesmos limites do bucket "vendor-portfolio" (migration 20260806000005) — repetidos
// aqui de propósito: o teto/allowlist do bucket é um backstop, não a única linha de
// defesa (mesma disciplina de re-validação real usada em wedding-files/album).
const MAX_PORTFOLIO_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_PORTFOLIO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']

// Registra os metadados de uma foto de portfólio já enviada direto pro Storage pelo
// browser (mesmo desenho de uploadWeddingFile). O client alega file.type/file.size no
// momento do upload — nunca confiamos nisso: aqui listamos o objeto de verdade no
// bucket e conferimos tamanho/MIME reais antes de gravar o registro.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)

    const body = await parseJsonBody(req)
    const parsed = CreateVendorPortfolioItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    // O path precisa começar com o vendor_id porque é isso que a policy de
    // storage.objects usa (fn_owns_vendor) para checar posse do arquivo.
    if (!parsed.data.storage_path.startsWith(`${vendor.id}/`)) {
      return err(400, 'VALIDATION_ERROR', 'Caminho de armazenamento inválido para este fornecedor.')
    }

    const objectName = parsed.data.storage_path.slice(vendor.id.length + 1)
    const { data: listing, error: listError } = await supabase.storage
      .from('vendor-portfolio')
      .list(vendor.id, { search: objectName })

    const storedObject = listing?.find((item) => item.name === objectName)
    if (listError || !storedObject) {
      return err(400, 'VALIDATION_ERROR', 'Arquivo não encontrado no armazenamento. Envie novamente.')
    }

    const actualSizeBytes = storedObject.metadata?.size as number | undefined
    const actualMimeType   = storedObject.metadata?.mimetype as string | undefined

    if (!actualSizeBytes || actualSizeBytes > MAX_PORTFOLIO_FILE_SIZE_BYTES) {
      await supabase.storage.from('vendor-portfolio').remove([parsed.data.storage_path])
      return err(400, 'FILE_TOO_LARGE', 'A foto excede o tamanho máximo permitido (10 MB).')
    }

    if (!actualMimeType || !ALLOWED_PORTFOLIO_MIME_TYPES.includes(actualMimeType)) {
      await supabase.storage.from('vendor-portfolio').remove([parsed.data.storage_path])
      return err(400, 'INVALID_FILE_TYPE', 'Formato de imagem não suportado. Envie JPG, PNG, WEBP ou HEIC.')
    }

    const { data, error } = await supabase
      .from('vendor_portfolio_items')
      .insert({
        vendor_id:    vendor.id,
        storage_path: parsed.data.storage_path,
        caption:      parsed.data.caption ?? null,
        sort_order:   parsed.data.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      // Metadados falharam ao gravar — remove o objeto órfão do Storage (mesmo
      // padrão de uploadWeddingFile quando o registro pós-upload falha).
      await supabase.storage.from('vendor-portfolio').remove([parsed.data.storage_path])
      return err(500, 'DB_ERROR', 'Erro ao registrar foto do portfólio.')
    }

    return ok(data as VendorPortfolioItem, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
