import { z } from 'zod'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { reauthenticateWithPassword } from '@/lib/auth/reauthenticate'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

const DeleteAccountBodySchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória').max(200),
})

// LGPD: soft delete apenas — a exclusão definitiva é feita pela function
// fn_purge_soft_deleted_accounts (agendada via pg_cron), 30 dias depois.
//
// SEC-009: exige e valida a senha ATUAL no servidor (reauthenticateWithPassword)
// ANTES de marcar qualquer coisa para exclusão — antes, bastava estar logado e
// confirmar num modal de UI, sem prova de posse da senha.
export async function DELETE(req: Request) {
  try {
    const body = await parseJsonBody(req)
    const parsed = DeleteAccountBodySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Informe sua senha atual para confirmar a exclusão.', parsed.error.flatten())
    }

    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    // Lança ApiError(401) e interrompe aqui se a senha atual estiver errada — nada
    // é marcado para exclusão nesse caso.
    await reauthenticateWithPassword(supabase, user, parsed.data.currentPassword)

    const { error } = await supabase
      .from('weddings')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (error) return err(500, 'DB_ERROR', 'Não foi possível processar a exclusão.')

    const scheduledPurgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    return ok({ scheduled_purge_at: scheduledPurgeAt })
  } catch (error) {
    return handleApiError(error)
  }
}
