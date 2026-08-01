import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Limpa as respostas do questionário de personalização (wedding_preferences) de um
// usuário, pra ele refazer do zero em /checklist/personalizar — não mexe no
// checklist já gerado, só no que é pré-preenchido na próxima vez que o questionário
// for aberto. wedding_preferences não tem policy de admin (só membro do próprio
// casamento), por isso service role.
export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    await requireAdmin(supabase, user.id)

    const limitCheck = await checkRateLimit(supabase, `admin-reset-preferences:${user.id}`, 30, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const { id } = await params
    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'USER_NOT_FOUND', 'Usuário não encontrado.')
    }

    const serviceSupabase = createSupabaseService()

    const { data: wedding } = await serviceSupabase
      .from('weddings')
      .select('id')
      .eq('user_id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!wedding) return err(404, 'WEDDING_NOT_FOUND', 'Este usuário ainda não tem casamento cadastrado.')

    const { error } = await serviceSupabase
      .from('wedding_preferences')
      .delete()
      .eq('wedding_id', wedding.id as string)

    if (error) return err(500, 'DB_ERROR', 'Erro ao limpar as respostas do questionário.')

    return ok({ reset: true })
  } catch (error) {
    return handleApiError(error)
  }
}
