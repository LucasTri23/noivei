import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { RsvpTokenSchema, UpdateRsvpSchema } from '@/lib/api/validation/rsvp.schema'
import { getRsvpByToken } from '@/lib/rsvp/get-rsvp-by-token'
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

    const { data, error } = await supabase
      .from('guests')
      .update({ status: parsed.data.status })
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
