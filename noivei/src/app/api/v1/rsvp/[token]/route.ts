import { after } from 'next/server'

import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { RsvpTokenSchema, UpdateRsvpSchema } from '@/lib/api/validation/rsvp.schema'
import { checkGuestLimit } from '@/lib/billing/check-limit'
import { getRsvpByToken } from '@/lib/rsvp/get-rsvp-by-token'
import { phonesMatch } from '@/lib/rsvp/normalize-phone'
import { notifyRsvpResponse } from '@/lib/rsvp/notify-rsvp-response'
import { createSupabaseService } from '@/lib/supabase/service'

// Rota pública (sem auth): o token único do convidado é a credencial.
// Usa service role porque a RLS de guests só cobre o dono autenticado.

interface RouteContext {
  params: Promise<{ token: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { token } = await params

    const parsedToken = RsvpTokenSchema.safeParse(token)
    if (!parsedToken.success) {
      return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')
    }

    const supabase = createSupabaseService()
    const rsvp = await getRsvpByToken(supabase, parsedToken.data)

    if (!rsvp) return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')

    return ok(rsvp)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { token } = await params

    const parsedToken = RsvpTokenSchema.safeParse(token)
    if (!parsedToken.success) {
      return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateRsvpSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const supabase = createSupabaseService()

    // O telefone nunca é devolvido pro client (ver get-rsvp-by-token.ts) — o único
    // jeito de saber se bate é o próprio servidor comparar aqui. Busca o convidado
    // primeiro (sem incluir o telefone na resposta desta rota em nenhum caminho).
    const { data: existingGuest, error: fetchError } = await supabase
      .from('guests')
      .select('id, phone, name, group_name, wedding_id, party_size')
      .eq('rsvp_token', parsedToken.data)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao verificar o convite.')
    if (!existingGuest) return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')

    const submittedPhone = parsed.data.phone?.trim() ?? ''
    const storedPhone = (existingGuest.phone as string | null)?.trim() ?? ''

    // Primeira resposta (casal nunca cadastrou telefone pra esse convidado): aceita o
    // que for digitado e passa a ser o telefone de referência dali pra frente
    // ("confiar no primeiro uso"). Havendo telefone já cadastrado, tem que bater —
    // senão, quem está respondendo não é reconhecido como o convidado de verdade.
    if (storedPhone && !phonesMatch(storedPhone, submittedPhone)) {
      return err(
        403,
        'PHONE_MISMATCH',
        'O telefone informado não confere com o cadastrado pelos noivos. Fale com o casal para confirmar ou atualizar seu telefone.',
      )
    }

    const guestId    = existingGuest.id as string
    const weddingId  = existingGuest.wedding_id as string
    const partySize  = existingGuest.party_size as number
    const isConfirming = parsed.data.status === 'confirmado'

    // attending_count nunca confia no que o client alega como teto — o teto de
    // verdade é o party_size que o CASAL definiu pra este convite, vindo do banco.
    const attendingCount = isConfirming ? (parsed.data.attending_count ?? 1) : null
    if (isConfirming && attendingCount !== null && attendingCount > partySize) {
      return err(
        400,
        'ATTENDING_COUNT_EXCEEDS_PARTY_SIZE',
        `Este convite cobre até ${partySize} pessoa(s).`,
        { party_size: partySize },
      )
    }

    const companions = isConfirming ? (parsed.data.companions ?? []) : []

    // Acompanhantes existentes de uma resposta anterior (o convidado mudou a
    // quantidade, ou recusou depois de já ter confirmado com acompanhantes) — o
    // plano inteiro é regenerado a cada resposta, mesmo padrão já usado nas
    // parcelas do Financeiro: mais simples e seguro que editar incrementalmente.
    const { count: existingCompanionsCount } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('parent_guest_id', guestId)

    const netNewRows = companions.length - (existingCompanionsCount ?? 0)

    // Acompanhantes viram convidados de verdade — contam pro limite do plano do
    // casamento igual qualquer outro convidado. Sem essa checagem, um RSVP público
    // furaria o limite de convidados do plano Gratuito indefinidamente.
    if (netNewRows > 0) {
      const limitCheck = await checkGuestLimit(supabase, weddingId)
      if (limitCheck.current + netNewRows > limitCheck.limit) {
        return err(
          403,
          'GUEST_LIMIT_REACHED',
          'Não foi possível registrar todos os acompanhantes agora. Fale diretamente com o casal.',
        )
      }
    }

    const update: {
      status:          'confirmado' | 'recusado'
      phone?:          string
      attending_count: number | null
    } = { status: parsed.data.status, attending_count: attendingCount }
    if (!storedPhone && submittedPhone) update.phone = submittedPhone

    const { data, error } = await supabase
      .from('guests')
      .update(update)
      .eq('rsvp_token', parsedToken.data)
      .select('name, status, wedding_id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao registrar sua resposta.')
    if (!data) return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')

    // Apaga o plano de acompanhantes anterior e recria do zero a partir da resposta
    // atual — ordem importa: só apaga depois que o guest principal já foi
    // atualizado com sucesso acima, pra nunca ficar sem acompanhantes E sem o
    // status principal salvo ao mesmo tempo por causa de uma falha no meio.
    const { error: deleteCompanionsError } = await supabase
      .from('guests')
      .delete()
      .eq('parent_guest_id', guestId)

    if (deleteCompanionsError) return err(500, 'DB_ERROR', 'Erro ao atualizar acompanhantes.')

    if (companions.length > 0) {
      const mainGuestName = existingGuest.name as string
      const mainGroupName = existingGuest.group_name as string | null
      const companionGroupName = [mainGroupName, `(${mainGuestName})`].filter(Boolean).join(' ')

      const { error: insertCompanionsError } = await supabase
        .from('guests')
        .insert(
          companions.map((companion) => ({
            wedding_id:      weddingId,
            name:            companion.name,
            phone:           companion.phone,
            group_name:      companionGroupName,
            status:          'confirmado' as const,
            party_size:      1,
            parent_guest_id: guestId,
          })),
        )

      if (insertCompanionsError) return err(500, 'DB_ERROR', 'Erro ao registrar acompanhantes.')
    }

    // E-mail de notificação pro dono do casamento é best-effort e não pode atrasar
    // nem quebrar a resposta ao convidado: agendado via after() para rodar só depois
    // da resposta HTTP já ter sido enviada (ver notifyRsvpResponse — erros só logam).
    if (data.status === 'confirmado' || data.status === 'recusado') {
      const weddingId = data.wedding_id as string
      const guestName = data.name as string
      const guestStatus = data.status as 'confirmado' | 'recusado'

      after(() =>
        notifyRsvpResponse({ supabase, weddingId, guestName, status: guestStatus }),
      )
    }

    return ok({ name: data.name, status: data.status })
  } catch (error) {
    return handleApiError(error)
  }
}
