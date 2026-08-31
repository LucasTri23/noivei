import { z } from 'zod'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { reauthenticateWithPassword } from '@/lib/auth/reauthenticate'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

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

    const nowIso = new Date().toISOString()

    const { error } = await supabase
      .from('weddings')
      .update({ deleted_at: nowIso, is_active: false })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (error) return err(500, 'DB_ERROR', 'Não foi possível processar a exclusão.')

    // Conta híbrida (casamento + fornecedor, ver 20260806000002) ou 100% fornecedor:
    // marca o próprio vendor_profiles também, senão fn_purge_soft_deleted_accounts
    // (que agora também expurga contas 100% fornecedor, ver 20260831000005) nunca
    // encontra este user_id — sem linha em `weddings` nenhuma, ou com a linha de
    // weddings já soft-deletada mas o vendor "esquecido" ativo pra sempre.
    // Service role, não o client autenticado normal: deleted_at é um campo
    // privilegiado protegido por trigger desde a correção de segurança em
    // 20260831000001 (fn_protect_vendor_profile_privileged_fields só libera
    // service_role/admin) — o próprio dono nunca teria permissão de gravar isso
    // pela RLS/trigger normal, mesmo já reautenticado por senha como aqui.
    const serviceSupabase = createSupabaseService()
    await serviceSupabase
      .from('vendor_profiles')
      .update({ deleted_at: nowIso })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    const scheduledPurgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    return ok({ scheduled_purge_at: scheduledPurgeAt })
  } catch (error) {
    return handleApiError(error)
  }
}
