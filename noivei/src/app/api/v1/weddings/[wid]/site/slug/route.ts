import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { SiteSlugSchema } from '@/lib/api/validation/site.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { siteSlugAlternatives, type SlugAvailability } from '@/lib/site/slug'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ wid: string }>
}

/**
 * GET /api/v1/weddings/[wid]/site/slug?value=ana-e-joao
 * Confere, enquanto o casal digita, se o endereço do site está livre. O slug é
 * único entre TODOS os casamentos e a RLS só mostra o site do próprio casal (ou
 * os publicados), então a consulta usa o client de serviço — devolvendo apenas
 * livre/ocupado, nunca de quem é o endereço.
 */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const parsed = SiteSlugSchema.safeParse(new URL(req.url).searchParams.get('value') ?? '')
    if (!parsed.success) {
      return ok<SlugAvailability>({ slug: '', available: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' })
    }

    const slug = parsed.data
    const candidates = [slug, ...siteSlugAlternatives(slug)]
    const { data, error } = await createSupabaseService()
      .from('site_config')
      .select('slug, wedding_id')
      .in('slug', candidates)

    if (error) return err(500, 'DB_ERROR', 'Não foi possível verificar o endereço.')

    const takenByOthers = new Set((data ?? []).filter((row) => row.wedding_id !== wid).map((row) => row.slug as string))
    if (!takenByOthers.has(slug)) return ok<SlugAvailability>({ slug, available: true })

    return ok<SlugAvailability>({
      slug,
      available:  false,
      message:    'Este endereço já está em uso por outro casal.',
      suggestion: candidates.find((candidate) => !takenByOthers.has(candidate)),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
