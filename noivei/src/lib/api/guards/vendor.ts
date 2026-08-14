import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'
import type { VendorProfile } from '@/types/database'

/**
 * Garante que o usuário autenticado tem um perfil de fornecedor (vendor_profiles) e
 * retorna a linha inteira — usado por toda rota de autoedição do fornecedor
 * (categorias, portfólio, envio para análise). Mesmo padrão de privacidade de
 * requireWeddingOwnership: 404 (não 403), pra não vazar detalhe nenhum sobre o
 * porquê do acesso ter sido negado.
 */
export async function requireVendorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorProfile> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'DB_ERROR', 'Erro ao buscar perfil de fornecedor.')
  }

  if (!data) {
    throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Perfil de fornecedor não encontrado.')
  }

  return data as VendorProfile
}
