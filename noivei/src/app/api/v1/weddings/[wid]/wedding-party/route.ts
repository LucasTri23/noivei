import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateWeddingPartyEntrySchema } from '@/lib/api/validation/wedding-party.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkWeddingPartyLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingPartyEntry } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export interface WeddingPartyEntryWithGuest extends WeddingPartyEntry {
  guest_name:   string
  guest_status: string
}

interface EntryRow extends WeddingPartyEntry {
  guests: { name: string; status: string } | null
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'padrinhos')

    const { data, error } = await supabase
      .from('wedding_party_entries')
      .select('*, guests(name, status)')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: true })

    if (error) return err(500, 'DB_ERROR', 'Erro ao listar entradas do cortejo.')

    const result: WeddingPartyEntryWithGuest[] = ((data ?? []) as unknown as EntryRow[]).map(
      ({ guests, ...entry }) => ({
        ...entry,
        guest_name:   guests?.name ?? '',
        guest_status: guests?.status ?? '',
      }),
    )

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'padrinhos')

    const body = await parseJsonBody(req)
    const parsed = CreateWeddingPartyEntrySchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, status')
      .eq('id', parsed.data.guest_id)
      .eq('wedding_id', wid)
      .maybeSingle()

    if (guestError) return err(500, 'DB_ERROR', 'Erro ao verificar o convidado.')
    if (!guest) return err(404, 'GUEST_NOT_FOUND', 'Convidado não encontrado.')
    if (guest.status !== 'confirmado') {
      return err(400, 'GUEST_NOT_CONFIRMED', 'Apenas convidados confirmados podem entrar no cortejo.')
    }

    if (parsed.data.paired_with_entry_id) {
      const { data: pairEntry, error: pairError } = await supabase
        .from('wedding_party_entries')
        .select('id')
        .eq('id', parsed.data.paired_with_entry_id)
        .eq('wedding_id', wid)
        .maybeSingle()

      if (pairError) return err(500, 'DB_ERROR', 'Erro ao verificar o par informado.')
      if (!pairEntry) return err(404, 'PAIR_ENTRY_NOT_FOUND', 'Entrada do par não encontrada.')
    }

    const limitCheck = await checkWeddingPartyLimit(supabase, wid)
    if (!limitCheck.allowed) {
      return err(403, 'WEDDING_PARTY_LIMIT_REACHED', 'Limite de entradas do cortejo do seu plano atingido.', {
        current: limitCheck.current,
        limit:   limitCheck.limit,
      })
    }

    const { data: lastEntry, error: lastEntryError } = await supabase
      .from('wedding_party_entries')
      .select('sort_order')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastEntryError) return err(500, 'DB_ERROR', 'Erro ao calcular a ordem de entrada.')

    const nextSortOrder = ((lastEntry?.sort_order as number | undefined) ?? -1) + 1

    const { data, error } = await supabase
      .from('wedding_party_entries')
      .insert({
        wedding_id:           wid,
        guest_id:             parsed.data.guest_id,
        role:                 parsed.data.role,
        carries_rings:        parsed.data.carries_rings ?? false,
        paired_with_entry_id: parsed.data.paired_with_entry_id ?? null,
        sort_order:           nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return err(409, 'GUEST_ALREADY_IN_PARTY', 'Este convidado já faz parte do cortejo.')
      }
      return err(500, 'DB_ERROR', 'Erro ao adicionar entrada ao cortejo.')
    }

    return ok(data as WeddingPartyEntry, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
