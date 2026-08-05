import { z } from 'zod'

import { requireWeddingOwnerOrFullAccess } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { reauthenticateWithPassword } from '@/lib/auth/reauthenticate'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

const DisconnectBodySchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória').max(200),
})

// Dono ou membro com full_access apenas — mesma restrição do connect (achado SEC-03).
//
// SEC-009: exige e valida a senha ATUAL no servidor (reauthenticateWithPassword)
// antes de desconectar — ação reversível (dá pra reconectar depois), por isso mais
// simples que a exclusão de conta: só senha, sem texto de confirmação.
export async function POST(req: Request, { params }: { params: Promise<{ wid: string }> }) {
  try {
    const body = await parseJsonBody(req)
    const parsed = DisconnectBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Informe sua senha atual para confirmar.', parsed.error.flatten())
    }

    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    // Lança ApiError(401) e interrompe aqui se a senha atual estiver errada — nada
    // é desconectado nesse caso.
    await reauthenticateWithPassword(supabase, user, parsed.data.currentPassword)

    await requireWeddingOwnerOrFullAccess(supabase, wid, user.id)

    // wedding_mp_accounts não tem policy pra client comum (guarda token de acesso a
    // dinheiro de terceiro) — as checagens de senha e de dono acima já aconteceram,
    // então a escrita em si usa service role.
    const { error } = await createSupabaseService()
      .from('wedding_mp_accounts')
      .delete()
      .eq('wedding_id', wid)

    if (error) return err(500, 'DB_ERROR', 'Erro ao desconectar a conta.')

    return ok({ disconnected: true })
  } catch (error) {
    return handleApiError(error)
  }
}
