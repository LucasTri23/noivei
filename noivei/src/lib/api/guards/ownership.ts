import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Garante que o casamento existe, pertence ao usuário e não foi soft-deletado.
 * Retorna 404 em qualquer caso negativo — mesmo padrão do RLS, que retorna
 * vazio (não erro) para não vazar a existência de recurso de outro usuário.
 */
export async function requireWeddingOwnership(
  supabase: SupabaseClient,
  weddingId: string,
  userId: string,
): Promise<void> {
  // id malformado também vira 404 para não diferenciar de inexistente
  if (!UUID_REGEX.test(weddingId)) {
    throw new ApiError(404, 'WEDDING_NOT_FOUND', 'Casamento não encontrado.')
  }

  const { data, error } = await supabase
    .from('weddings')
    .select('id')
    .eq('id', weddingId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'DB_ERROR', 'Erro ao verificar o casamento.')
  }

  if (!data) {
    throw new ApiError(404, 'WEDDING_NOT_FOUND', 'Casamento não encontrado.')
  }
}
