import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/response'
export type AccountType = 'couple' | 'vendor'
export function accountTypeForPath(path: string | null): AccountType {
  return path === '/fornecedor' || path?.startsWith('/fornecedor/') ? 'vendor' : 'couple'
}
export async function requireAccountType(supabase: SupabaseClient, type: AccountType): Promise<void> {
  const { error } = await supabase.rpc('fn_claim_account_type', { p_type: type })
  if (error?.code === '22023') throw new ApiError(409, 'ACCOUNT_TYPE_CONFLICT', 'Este e-mail pertence a outro tipo de conta. Use a área correspondente ou outro e-mail.')
  if (error) throw new ApiError(500, 'DB_ERROR', 'Não foi possível verificar o tipo da conta.')
}
