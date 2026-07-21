import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { RsvpTokenSchema, UpdateRsvpSchema } from '@/lib/api/validation/rsvp.schema'
import { getRsvpByToken } from '@/lib/rsvp/get-rsvp-by-token'
import { phonesMatch } from '@/lib/rsvp/normalize-phone'
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
      .select('phone')
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

    const update: { status: 'confirmado' | 'recusado'; phone?: string } = { status: parsed.data.status }
    if (!storedPhone && submittedPhone) update.phone = submittedPhone

    const { data, error } = await supabase
      .from('guests')
      .update(update)
      .eq('rsvp_token', parsedToken.data)
      .select('name, status')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao registrar sua resposta.')
    if (!data) return err(404, 'RSVP_NOT_FOUND', 'Convite não encontrado.')

    return ok({ name: data.name, status: data.status })
  } catch (error) {
    return handleApiError(error)
  }
}
