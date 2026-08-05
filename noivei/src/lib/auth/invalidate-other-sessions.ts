import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseService } from '@/lib/supabase/service'

// SEC-007: derruba todas as OUTRAS sessões do usuário, mantendo a sessão desta
// requisição logada.
//
// `supabase.auth.admin.signOut(jwt, scope)` (Admin API, precisa de service role —
// GoTrueAdminApi do @supabase/auth-js instalado, versão 2.110.0) recebe o access
// token de UMA sessão específica como primeiro argumento — não o userId, apesar do
// nome sugerir. Com `scope: 'others'` ele chama POST /logout?scope=others no GoTrue
// autenticado com esse token, que revoga todas as sessões do MESMO usuário
// associadas a qualquer OUTRO token, preservando a sessão dona do token passado.
// Por isso pegamos aqui o access_token da sessão atual (a que acabou de
// reautenticar/trocar a senha) e o usamos como o token a preservar.
//
// Nunca lança: é chamada depois de uma ação que já teve sucesso (troca de senha),
// então uma falha aqui é só logada — não pode travar a ação principal.
export async function invalidateOtherSessions(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return

    const { error } = await createSupabaseService().auth.admin.signOut(accessToken, 'others')
    if (error) {
      console.error('[invalidateOtherSessions] falha ao invalidar outras sessões:', error.message)
    }
  } catch (error) {
    console.error('[invalidateOtherSessions] erro inesperado ao invalidar outras sessões:', error)
  }
}
