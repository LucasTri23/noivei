import { ok, err, handleApiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ slug: string }>
}

// Mesmo teto de itens que uma grade de portfólio poderia razoavelmente ter —
// mais que isso não faz sentido como "portfólio" de um único fornecedor.
const PORTFOLIO_ITEM_LIMIT = 200

// Mesma ordem de grandeza/raciocínio do TTL usado no mural público
// (GET /api/v1/album/[slug]/gallery): página pública que alguém pode deixar
// aberta rolando por alguns minutos, sem virar um link "permanente". A cada
// novo GET as URLs são regeradas do zero.
const SIGNED_URL_TTL_SECONDS = 8 * 60

export interface PublicVendorPortfolioItem {
  id:      string
  caption: string | null
  url:     string | null
}

// Rota pública (sem auth) — gera signed URLs pro bucket privado "vendor-portfolio"
// (migration 20260806000005: bucket sem NENHUMA policy de SELECT pra
// anon/authenticated-que-não-é-dono, de propósito — visualização pública só passa
// por aqui). Service role é OBRIGATÓRIO pra ler o Storage, mas isso significa que a
// RLS de vendor_profiles NÃO filtra nada aqui — a checagem de visibilidade
// (fn_vendor_is_publicly_visible, a mesma function centralizada que a RLS usa) tem
// que ser feita EXPLICITAMENTE abaixo antes de gerar qualquer signed URL, senão um
// fornecedor draft/pending_review/suspended/rejected vazaria as fotos do portfólio
// mesmo sem aparecer no marketplace.
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params
    const decodedSlug = decodeURIComponent(slug)

    const supabase = createSupabaseService()

    // Mesma disciplina de rate limit por IP já aplicada em toda leitura pública
    // anônima do projeto (ver album gallery) — risco menor aqui (só leitura, sem
    // escrita anônima envolvida), mas ainda é uma superfície nova de geração de
    // signed URL sem autenticação.
    const ipLimit = await checkRateLimit(supabase, `vendor-portfolio:ip:${getClientIp(req)}`, 120, 3600)
    if (!ipLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const { data: vendor, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('slug', decodedSlug)
      .maybeSingle()

    // Mesmo erro genérico pra slug inexistente E fornecedor não-público (checado
    // logo abaixo) — não vazar a existência de um cadastro ainda não aprovado.
    if (vendorError || !vendor) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const vendorId = vendor.id as string

    const { data: isPublic, error: visibilityError } = await supabase
      .rpc('fn_vendor_is_publicly_visible', { p_vendor_id: vendorId })

    if (visibilityError || !isPublic) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const vendorLimit = await checkRateLimit(supabase, `vendor-portfolio:vendor:${vendorId}`, 3000, 3600)
    if (!vendorLimit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const { data: items, error: itemsError } = await supabase
      .from('vendor_portfolio_items')
      .select('id, storage_path, caption')
      .eq('vendor_id', vendorId)
      .order('sort_order')
      .limit(PORTFOLIO_ITEM_LIMIT)

    if (itemsError) return err(500, 'DB_ERROR', 'Erro ao carregar o portfólio.')

    const withUrls: PublicVendorPortfolioItem[] = await Promise.all(
      (items ?? []).map(async (item) => {
        const { data: signed } = await supabase.storage
          .from('vendor-portfolio')
          .createSignedUrl(item.storage_path as string, SIGNED_URL_TTL_SECONDS)

        return { id: item.id as string, caption: item.caption as string | null, url: signed?.signedUrl ?? null }
      }),
    )

    return ok(withUrls)
  } catch (error) {
    return handleApiError(error)
  }
}
