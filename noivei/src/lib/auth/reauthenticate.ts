import type { SupabaseClient, User } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'

// SEC-009: revalida a senha ATUAL do usuário chamando signInWithPassword de novo —
// é assim que o projeto reautentica pra ações sensíveis (troca de senha, exclusão
// de conta, desconectar Mercado Pago). Sem mecanismo de "sessão elevada" com
// expiração própria: cada ação sensível pede a senha de novo, e a validade dessa
// reautenticação é só a duração da própria requisição.
//
// Lança ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.') se a senha
// estiver errada (ou se o usuário não tiver e-mail associado — não deveria
// acontecer em login por senha, mas o campo é opcional no tipo `User`). Nunca loga
// a senha recebida.
export async function reauthenticateWithPassword(
  supabase: SupabaseClient,
  user:     Pick<User, 'email'>,
  password: string,
): Promise<void> {
  if (!user.email) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.')
  }

  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
  if (error) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.')
  }
}
