import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateVendorConversationSchema } from '@/lib/api/validation/vendor-conversation.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'
import { getUserWedding, hasModuleAccess } from '@/lib/weddings/get-user-wedding'
import type { VendorConversation } from '@/types/database'

const CREATE_CONVERSATION_ATTEMPTS = 3

// Só o lado do CASAL chama este POST (o fornecedor nunca inicia — mesma regra já
// vale na RLS de vendor_conversations, ver migration 20260806000004). find-or-create
// respeitando UNIQUE(wedding_id, vendor_id): o casal tem exatamente UMA conversa por
// fornecedor pra sempre, então clicar "Conversar" de novo num fornecedor já
// contatado deve reabrir a mesma conversa, não criar outra.
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    const userWedding = await getUserWedding(supabase, user.id)
    if (!userWedding || !hasModuleAccess(userWedding, 'fornecedores')) {
      return err(403, 'MODULE_ACCESS_DENIED', 'Você não tem permissão para acessar este módulo.')
    }

    // Iniciar uma conversa nova é uma ação pouco frequente em uso normal (o comum é
    // reabrir uma já existente, que nem passa pelo insert abaixo) — teto generoso o
    // bastante pra alguém comparando vários fornecedores numa sessão, mas que
    // impede um loop automatizado de abrir conversa com o marketplace inteiro.
    const limitCheck = await checkRateLimit(supabase, `vendor-conversation-create:${user.id}`, 30, 3600)
    if (!limitCheck.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const body = await parseJsonBody(req)
    const parsed = CreateVendorConversationSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { vendor_id } = parsed.data

    // Mesmo critério de "existe e está visível" usado no marketplace/portfólio
    // público — não deixa iniciar conversa com fornecedor draft/pending_review/
    // suspenso/rejeitado (nem vaza qual desses é o motivo, erro genérico).
    const { data: isPublic, error: visibilityError } = await supabase
      .rpc('fn_vendor_is_publicly_visible', { p_vendor_id: vendor_id })
    if (visibilityError || !isPublic) {
      return err(404, 'VENDOR_NOT_FOUND', 'Fornecedor não encontrado.')
    }

    const { data: existing, error: existingError } = await supabase
      .from('vendor_conversations')
      .select('*')
      .eq('wedding_id', userWedding.id)
      .eq('vendor_id', vendor_id)
      .maybeSingle()

    if (existingError) return err(500, 'DB_ERROR', 'Erro ao verificar conversa existente.')
    if (existing) return ok(existing as VendorConversation, undefined, 200)

    for (let attempt = 0; attempt < CREATE_CONVERSATION_ATTEMPTS; attempt++) {
      const { data, error } = await supabase
        .from('vendor_conversations')
        .insert({ wedding_id: userWedding.id, vendor_id, created_by: user.id })
        .select()
        .single()

      if (!error) return ok(data as VendorConversation, undefined, 201)

      if (error.code === '23505') {
        // Corrida contra outra aba/requisição que criou a MESMA conversa
        // (wedding_id, vendor_id) entre a checagem acima e este insert — não é erro
        // de verdade, "conversa já existe" é resultado normal aqui, não estado de
        // falha (mesmo espírito do retry-on-23505 de vendor/profile route.ts).
        const { data: raceWinner } = await supabase
          .from('vendor_conversations')
          .select('*')
          .eq('wedding_id', userWedding.id)
          .eq('vendor_id', vendor_id)
          .maybeSingle()
        if (raceWinner) return ok(raceWinner as VendorConversation, undefined, 200)
        continue
      }

      return err(500, 'DB_ERROR', 'Erro ao iniciar conversa.')
    }

    return err(500, 'DB_ERROR', 'Não foi possível iniciar a conversa. Tente novamente.')
  } catch (error) {
    return handleApiError(error)
  }
}

// Lista as conversas do usuário autenticado — casal e/ou fornecedor, um usuário
// híbrido (tem casamento E é fornecedor) enxerga as duas pontas via
// fn_list_vendor_conversations (migration 20260807000002), daí o filtro opcional
// `?as=couple|vendor` pra cada tela (conversas do casal vs. conversas do
// fornecedor) só mostrar a metade que faz sentido nela.
export async function GET(req: Request) {
  try {
    await requireAuth()
    const supabase = await createSupabaseServer()

    const url = new URL(req.url)
    const asParam = url.searchParams.get('as')
    const roleFilter = asParam === 'couple' || asParam === 'vendor' ? asParam : null

    const { data, error } = await supabase.rpc('fn_list_vendor_conversations')
    if (error) return err(500, 'DB_ERROR', 'Erro ao carregar conversas.')

    const rows = (data ?? []) as VendorConversationListItem[]
    const filtered = roleFilter ? rows.filter((row) => row.viewer_role === roleFilter) : rows

    return ok(filtered)
  } catch (error) {
    return handleApiError(error)
  }
}
