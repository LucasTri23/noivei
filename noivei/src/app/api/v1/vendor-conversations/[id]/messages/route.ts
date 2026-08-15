import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { SendVendorMessageSchema } from '@/lib/api/validation/vendor-conversation.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorMessage } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 50

// A RLS de vendor_conversations (fn_can_access_conversation, ver migration
// 20260806000004) já garante que só participante lê a linha — esta consulta de
// "a conversa existe?" faz dupla função: é a checagem de posse em código (mesmo
// espírito de requireVendorProfile — 404, não 403, pra não vazar se o id existe
// mas não é seu) E evita ter que repetir a lógica de fn_can_access_conversation
// aqui: se a RLS já deixa passar, é porque o usuário pode acessar.
async function requireConversationAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from('vendor_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()

  if (error) return { ok: false as const, response: err(500, 'DB_ERROR', 'Erro ao verificar a conversa.') }
  if (!data) return { ok: false as const, response: err(404, 'CONVERSATION_NOT_FOUND', 'Conversa não encontrada.') }
  return { ok: true as const }
}

// Paginação por cursor (?before=<timestamp ISO>) em vez de offset — evita o
// "drift" clássico de offset quando mensagens novas chegam entre uma página e
// outra (não há precedente de scroll infinito neste projeto pra seguir, esta é a
// abordagem mais simples que não quebra com escrita concorrente).
export async function GET(req: Request, { params }: RouteContext) {
  try {
    await requireAuth()
    const supabase = await createSupabaseServer()
    const { id } = await params

    const access = await requireConversationAccess(supabase, id)
    if (!access.ok) return access.response

    const url = new URL(req.url)
    const before = url.searchParams.get('before')
    const limitParam = Number(url.searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT

    let query = supabase
      .from('vendor_messages')
      .select('*')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      const beforeDate = new Date(before)
      if (Number.isNaN(beforeDate.getTime())) {
        return err(400, 'VALIDATION_ERROR', 'Parâmetro "before" inválido.')
      }
      query = query.lt('created_at', beforeDate.toISOString())
    }

    const { data, error } = await query
    if (error) return err(500, 'DB_ERROR', 'Erro ao carregar mensagens.')

    // A query pede DESC (mais nova primeiro) pra o LIMIT pegar as N mais recentes
    // (ou as N mais recentes ANTES do cursor) — devolve pro client já em ordem
    // cronológica (mais antiga primeiro), que é como o thread é renderizado.
    const messages = ((data ?? []) as VendorMessage[]).slice().reverse()
    const hasMore = messages.length === limit
    const nextCursor = messages.length > 0 ? messages[0]!.created_at : null

    return ok(messages, { hasMore, nextCursor })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { id } = await params

    const access = await requireConversationAccess(supabase, id)
    if (!access.ok) return access.response

    // 30 mensagens/minuto: uma conversa real entre duas pessoas digitando não
    // chega perto disso (mesmo uma rajada de mensagens curtas — "oi", "tudo bem?",
    // "sim" — cabe folgado), mas é baixo o bastante pra travar um script
    // despejando texto na caixa de entrada do outro lado. Chave por usuário (não
    // por conversa): o limite é sobre o comportamento da CONTA, não da conversa
    // específica.
    const limitCheck = await checkRateLimit(supabase, `vendor-message-send:${user.id}`, 30, 60)
    if (!limitCheck.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas mensagens em pouco tempo. Aguarde um instante.')
    }

    const body = await parseJsonBody(req)
    const parsed = SendVendorMessageSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    // sender_user_id É SEMPRE user.id, nunca lido do body (SendVendorMessageSchema
    // nem tem esse campo) — a RLS de INSERT em vendor_messages já barra um valor
    // forjado de forma independente (WITH CHECK sender_user_id = auth.uid(),
    // migration 20260806000004), mas o contrato desta rota é nem tentar repassar
    // um valor vindo do client.
    const { data, error } = await supabase
      .from('vendor_messages')
      .insert({ conversation_id: id, sender_user_id: user.id, body: parsed.data.body })
      .select()
      .single()

    if (error) return err(500, 'DB_ERROR', 'Erro ao enviar mensagem.')

    return ok(data as VendorMessage, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
