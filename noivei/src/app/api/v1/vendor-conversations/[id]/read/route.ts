import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Upsert do ponteiro "última leitura" — chamado quando o thread abre/rola até o
// fim (ver useVendorConversationThread). Sem body: o único dado é "agora", sempre
// o relógio do servidor (nunca aceitar um last_read_at vindo do client, que
// poderia ser forjado pra esconder mensagens não lidas de verdade).
export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { id } = await params

    const { data: conversation, error: convError } = await supabase
      .from('vendor_conversations')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (convError) return err(500, 'DB_ERROR', 'Erro ao verificar a conversa.')
    if (!conversation) return err(404, 'CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')

    const lastReadAt = new Date().toISOString()

    const { error } = await supabase
      .from('vendor_conversation_reads')
      .upsert(
        { conversation_id: id, user_id: user.id, last_read_at: lastReadAt },
        { onConflict: 'conversation_id,user_id' },
      )

    if (error) return err(500, 'DB_ERROR', 'Erro ao marcar conversa como lida.')

    return ok({ last_read_at: lastReadAt })
  } catch (error) {
    return handleApiError(error)
  }
}
