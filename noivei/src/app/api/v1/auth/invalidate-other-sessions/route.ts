import { ok, handleApiError } from '@/lib/api/response'
import { invalidateOtherSessions } from '@/lib/auth/invalidate-other-sessions'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

// SEC-007: usada pelo fluxo de redefinição de senha via link de e-mail
// (reset-password/page.tsx). A troca em si acontece no browser, usando a sessão de
// "recovery" temporária que o Supabase estabelece a partir do link — o e-mail já é
// a prova de identidade nesse fluxo, por isso não pede senha atual (diferente da
// troca autenticada em /auth/change-password). Depois de trocar com sucesso, o
// client chama esta rota pra derrubar as demais sessões do usuário (outros
// dispositivos/navegadores logados com a senha antiga).
//
// Rota fina só pra isso, reaproveitando invalidateOtherSessions (mesma função usada
// em /auth/change-password) em vez de duplicar a lógica de pegar o access_token da
// sessão atual e chamar a Admin API.
export async function POST() {
  try {
    await requireAuth()
    const supabase = await createSupabaseServer()
    await invalidateOtherSessions(supabase)

    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
