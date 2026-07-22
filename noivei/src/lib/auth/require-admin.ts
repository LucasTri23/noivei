import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'

/**
 * Garante que o usuário logado é admin (profiles.role = 'admin'). Retorna 404 (não
 * 403) pra não revelar que existe um painel administrativo pra quem não é admin —
 * mesmo padrão de privacidade usado em requireWeddingOwnership.
 *
 * Redundante com a RLS de plans/plan_limits/coupons (que já usa fn_is_admin nas
 * policies de escrita), mantido como defesa em profundidade e porque falhar cedo,
 * antes de qualquer query, é mais claro que deixar a RLS silenciosamente rejeitar.
 */
export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'DB_ERROR', 'Erro ao verificar permissão.')
  if (!data || data.role !== 'admin') throw new ApiError(404, 'NOT_FOUND', 'Página não encontrada.')
}
