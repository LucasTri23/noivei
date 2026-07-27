import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshOAuthAccessToken } from '@/lib/integrations/payment/mercadopago'

const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000 // renova 1 dia antes de expirar, não em cima da hora

/**
 * Retorna o access_token válido da conta Mercado Pago conectada pelo casal (renovando
 * via refresh_token se estiver perto de expirar) — usado pra criar o checkout de
 * presente com o token do CASAL, nunca o da Wednest. `supabase` deve ser um client
 * service role: wedding_mp_accounts não tem policy nenhuma pra client comum (guarda
 * credencial de acesso a dinheiro de terceiro).
 */
export async function getValidMpAccountAccessToken(
  supabase:  SupabaseClient,
  weddingId: string,
): Promise<string | null> {
  const { data: account } = await supabase
    .from('wedding_mp_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('wedding_id', weddingId)
    .maybeSingle()

  if (!account) return null

  const expiresAt = new Date(account.token_expires_at as string).getTime()
  if (expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return account.access_token as string
  }

  const refreshed = await refreshOAuthAccessToken(account.refresh_token as string)

  await supabase
    .from('wedding_mp_accounts')
    .update({
      access_token:     refreshed.accessToken,
      refresh_token:    refreshed.refreshToken,
      token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    })
    .eq('wedding_id', weddingId)

  return refreshed.accessToken
}
