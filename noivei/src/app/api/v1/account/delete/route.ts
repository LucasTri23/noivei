import { requireAuth } from '@/lib/auth/require-auth'
import { ok, err, handleApiError } from '@/lib/api/response'
import { createSupabaseServer } from '@/lib/supabase/server'

// LGPD: soft delete apenas — a exclusão definitiva é feita pela function
// fn_purge_soft_deleted_accounts (agendada via pg_cron), 30 dias depois.
export async function DELETE() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

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
