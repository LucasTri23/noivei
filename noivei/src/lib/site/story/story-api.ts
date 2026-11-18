import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { err } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

interface DbError {
  code?:    string
  hint?:    string | null
  message?: string
}

/** Auth → posse do casamento → permissão do módulo "site" (mesma ordem das demais rotas do site). */
export async function requireStoryAccess(wid: string): Promise<{ userId: string; supabase: SupabaseServer }> {
  const { user } = await requireAuth()
  const supabase = await createSupabaseServer()
  await requireWeddingOwnership(supabase, wid, user.id)
  await requireModuleAccess(supabase, wid, user.id, 'site')
  return { userId: user.id, supabase }
}

/** Confere na API (além da FK composta do banco) que o momento é deste casamento. */
export async function momentBelongsToWedding(supabase: SupabaseServer, wid: string, momentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('site_story_moments')
    .select('id')
    .eq('id', momentId)
    .eq('wedding_id', wid)
    .maybeSingle()
  return Boolean(data)
}

/** Traduz erros das regras do banco (tetos, FKs compostas, permissões) em respostas claras. */
export function storyDbErrorResponse(error: DbError, fallback: string): Response {
  if (error.hint === 'STORY_PHOTO_LIMIT') return err(409, 'STORY_PHOTO_LIMIT', 'Limite de 24 fotos na história atingido.')
  if (error.hint === 'STORY_MOMENT_LIMIT') return err(409, 'STORY_MOMENT_LIMIT', 'Limite de 20 momentos na história atingido.')
  if (error.code === '23503') return err(400, 'INVALID_MOMENT', 'O momento escolhido não pertence a este casamento.')
  if (error.code === '23505') return err(409, 'DUPLICATE_PHOTO', 'Esta foto já foi registrada.')
  if (error.code === '42501') return err(403, 'FORBIDDEN', 'Sem acesso ao site deste casamento.')
  if (error.code === '22023' || error.code === '23514') return err(400, 'VALIDATION_ERROR', 'Dados inválidos para a história.')
  return err(500, 'DB_ERROR', fallback)
}
