import { exchangeOAuthCode, fetchMpUserInfo } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseService } from '@/lib/supabase/service'

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // janela curta — só o tempo de ida e volta no MP

// Rota pública — o Mercado Pago redireciona o navegador do CASAL pra cá depois de
// ele autorizar a Wednest (ou negar). Sem sessão nenhuma nossa envolvida: quem
// vincula o code a um casamento é o `state` assinado/gravado em mp_oauth_states na
// hora de iniciar o fluxo (ver .../gift-payments/connect).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin
  const failRedirect = `${appUrl}/presentes?mp=erro`

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (url.searchParams.get('error') || !code || !state) {
    return Response.redirect(failRedirect, 302)
  }

  try {
    const supabase = createSupabaseService()

    const { data: stateRow } = await supabase
      .from('mp_oauth_states')
      .select('wedding_id, created_at')
      .eq('state', state)
      .maybeSingle()

    // Consumo único: apaga já na leitura, válido ou não — um `state` só serve uma vez.
    if (stateRow) {
      await supabase.from('mp_oauth_states').delete().eq('state', state)
    }

    if (!stateRow) return Response.redirect(failRedirect, 302)

    const age = Date.now() - new Date(stateRow.created_at as string).getTime()
    if (age > STATE_MAX_AGE_MS) return Response.redirect(failRedirect, 302)

    const weddingId = stateRow.wedding_id as string
    const redirectUri = `${appUrl}/api/v1/billing/mp-oauth-callback`

    const tokens = await exchangeOAuthCode(code, redirectUri)
    const userInfo = await fetchMpUserInfo(tokens.accessToken)

    const { error: upsertError } = await supabase
      .from('wedding_mp_accounts')
      .upsert({
        wedding_id:       weddingId,
        mp_user_id:       tokens.mpUserId,
        mp_email:         userInfo.email,
        mp_nickname:      userInfo.nickname,
        access_token:     tokens.accessToken,
        refresh_token:    tokens.refreshToken,
        token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      })

    if (upsertError) return Response.redirect(failRedirect, 302)

    return Response.redirect(`${appUrl}/presentes?mp=conectado`, 302)
  } catch (error) {
    console.error('[mp-oauth-callback] erro ao conectar conta:', error)
    return Response.redirect(failRedirect, 302)
  }
}
