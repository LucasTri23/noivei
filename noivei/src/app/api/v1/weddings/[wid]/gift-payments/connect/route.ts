import { requireWeddingOwnerOrFullAccess } from '@/lib/api/guards/ownership'
import { err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { getOAuthAuthorizationUrl } from '@/lib/integrations/payment/mercadopago'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

// Início do fluxo "Conectar minha conta Mercado Pago" (Fase 2 — presentes de
// convidado caem direto na conta do casal). Redireciona pro MP; o casal loga na
// própria conta e autoriza a Wednest a agir como marketplace pros presentes dele.
//
// Exige dono ou membro com full_access (não qualquer membro convidado, como um
// requireWeddingOwnership normal permitiria) — conectar a conta que recebe o
// dinheiro dos presentes é uma ação sensível de mesmo nível que gerenciar convites
// (achado SEC-03 da auditoria de segurança: um membro comum conseguia autorizar a
// PRÓPRIA conta MP a receber os presentes de um casamento que não é dele).
export async function GET(req: Request, { params }: { params: Promise<{ wid: string }> }) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnerOrFullAccess(supabase, wid, user.id)

    // `state` é o único jeito de o callback (sem sessão de usuário) saber a qual
    // casamento vincular o code devolvido pelo MP — sem isso, um terceiro poderia
    // reusar/forjar o retorno do OAuth pra vincular a própria conta MP a um
    // casamento alheio. Vida curta, checada em código no callback.
    const serviceSupabase = createSupabaseService()
    const { data: stateRow, error: stateError } = await serviceSupabase
      .from('mp_oauth_states')
      .insert({ wedding_id: wid })
      .select('state')
      .single()

    if (stateError || !stateRow) {
      return err(500, 'DB_ERROR', 'Erro ao iniciar conexão com o Mercado Pago.')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const redirectUri = `${appUrl}/api/v1/billing/mp-oauth-callback`
    const authUrl = getOAuthAuthorizationUrl(redirectUri, stateRow.state as string)

    return Response.redirect(authUrl, 302)
  } catch (error) {
    return handleApiError(error)
  }
}
