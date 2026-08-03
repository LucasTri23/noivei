import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { ValidateCheckinSchema } from '@/lib/api/validation/checkin.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'checkin')

    const body = await parseJsonBody(req)
    const parsed = ValidateCheckinSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    // Uma festa movimentada pode escanear centenas de convidados numa janela curta
    // na entrada — bem mais generoso que os rate limits de rotas públicas, mas
    // ainda existe pra conter um cliente com bug/loop escaneando sem parar.
    const limit = await checkRateLimit(supabase, `checkin-validate:wid:${wid}`, 300, 3600)
    if (!limit.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas validações em pouco tempo. Aguarde um instante e tente de novo.')
    }

    // A RLS de `guests` só reconhece o módulo 'convidados' (ver
    // 20260703000018_add-wedding-member-module-permissions.sql) — um membro com
    // permissão de 'checkin' mas sem 'convidados' (ex.: alguém escalado só pra
    // recepção no dia) seria bloqueado por ela mesmo já autorizado acima pelos
    // guards. Usa o client service role aqui, só depois de já ter confirmado
    // (requireWeddingOwnership + requireModuleAccess) que quem chamou pode
    // validar ingressos deste casamento — mesmo precedente de
    // src/app/api/v1/weddings/[wid]/members/route.ts.
    const serviceSupabase = createSupabaseService()

    const { data: guest, error: fetchError } = await serviceSupabase
      .from('guests')
      .select('id, wedding_id, name, status, party_size, checked_in_at')
      .eq('rsvp_token', parsed.data.token)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao verificar o ingresso.')

    // Token inexistente OU pertencente a outro casamento viram o MESMO erro —
    // não dá pra confirmar pra quem escaneou que o QR code existe, só que não é
    // deste casamento (é exatamente o caso "ingresso de outro casamento" que o
    // controle de entrada precisa barrar, sem vazar detalhe nenhum sobre ele).
    if (!guest || guest.wedding_id !== wid) {
      return err(404, 'TICKET_NOT_FOUND', 'Ingresso não encontrado.')
    }

    if (guest.status !== 'confirmado') {
      return err(400, 'NOT_CONFIRMED', 'Este convidado não confirmou presença.')
    }

    // Ingresso já usado uma vez não pode ser usado de novo — bloqueia de verdade
    // (não é só um aviso informativo), pra impedir alguém reutilizando print/foto
    // do mesmo QR code pra entrar mais de uma vez ou passar pra outra pessoa.
    if (guest.checked_in_at) {
      const usedAt = new Date(guest.checked_in_at as string).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      })
      return err(409, 'ALREADY_CHECKED_IN', `Este ingresso já foi usado às ${usedAt}.`)
    }

    const { data: updated, error: updateError } = await serviceSupabase
      .from('guests')
      .update({ checked_in_at: new Date().toISOString() })
      .eq('id', guest.id)
      .select('name, party_size, checked_in_at')
      .single()

    if (updateError || !updated) return err(500, 'DB_ERROR', 'Erro ao registrar o check-in.')

    return ok({
      guest_name:         updated.name as string,
      party_size:         updated.party_size as number,
      already_checked_in: false,
      checked_in_at:      updated.checked_in_at as string,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
