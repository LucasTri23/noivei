import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Garante que o casamento existe, o usuário é dono OU membro convidado (ver
 * wedding_members/"juntar contas"), e não foi soft-deletado. Retorna 404 em
 * qualquer caso negativo — mesmo padrão do RLS, que retorna vazio (não erro)
 * para não vazar a existência de recurso de outro usuário/casamento.
 *
 * Esta checagem em código é redundante com a RLS de cada tabela (que já usa
 * fn_is_wedding_member), mas é mantida como defesa em profundidade e porque
 * retornar 404 cedo, antes de qualquer query de escrita, é mais claro do que
 * deixar a RLS silenciosamente não afetar nenhuma linha.
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

  // Consulta a partir de wedding_members (não de weddings): wedding_id+user_id é a
  // chave única indexada da tabela, e o !inner em weddings confere de quebra que o
  // casamento não foi soft-deletado.
  const { data, error } = await supabase
    .from('wedding_members')
    .select('wedding_id, weddings!inner(deleted_at)')
    .eq('wedding_id', weddingId)
    .eq('user_id', userId)
    .is('weddings.deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'DB_ERROR', 'Erro ao verificar o casamento.')
  }

  if (!data) {
    throw new ApiError(404, 'WEDDING_NOT_FOUND', 'Casamento não encontrado.')
  }
}

/**
 * Garante que o usuário é especificamente o DONO do casamento (não um membro
 * convidado) — usado nas rotas de gestão de membros/convites, que ficam
 * restritas ao dono mesmo que membros tenham acesso igual ao resto dos dados.
 */
export async function requireWeddingOwner(
  supabase: SupabaseClient,
  weddingId: string,
  userId: string,
): Promise<void> {
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
