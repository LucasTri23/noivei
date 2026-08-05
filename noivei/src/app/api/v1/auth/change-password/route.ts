import { z } from 'zod'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { invalidateOtherSessions } from '@/lib/auth/invalidate-other-sessions'
import { reauthenticateWithPassword } from '@/lib/auth/reauthenticate'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

// SEC-007: troca de senha autenticada (tela de segurança do perfil) agora exige a
// senha ATUAL, revalidada via reauthenticateWithPassword — antes, `updateUser`
// era chamado direto no client sem checar nada além da sessão já logada. Depois de
// trocar com sucesso, derruba todas as OUTRAS sessões do usuário (ver
// invalidateOtherSessions) — a sessão que fez esta requisição continua logada,
// qualquer outro dispositivo/navegador com a senha antiga é desconectado.
const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória').max(200),
  newPassword:     z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres').max(200),
})

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = ChangePasswordBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Revise os campos destacados e tente novamente.', parsed.error.flatten())
    }

    const { currentPassword, newPassword } = parsed.data

    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    // Lança ApiError(401) se a senha atual estiver errada — não chega a tocar em
    // updateUser nesse caso.
    await reauthenticateWithPassword(supabase, user, currentPassword)

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      const message = updateError.message.includes('different from the old password')
        ? 'A nova senha precisa ser diferente da atual.'
        : 'Não foi possível alterar a senha. Tente novamente.'
      return err(400, 'PASSWORD_UPDATE_FAILED', message)
    }

    // Nunca deve travar a troca de senha em si — uma falha aqui é só logada dentro
    // de invalidateOtherSessions.
    await invalidateOtherSessions(supabase)

    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
