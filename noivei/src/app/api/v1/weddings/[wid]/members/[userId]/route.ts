import { z } from 'zod'

import { requireWeddingOwner } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { WeddingMemberPermissionsSchema } from '@/lib/api/validation/invite.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import type { WeddingMember } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; userId: string }>
}

const UpdateMemberPermissionsSchema = z.object({ permissions: WeddingMemberPermissionsSchema })

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, userId } = await params

    await requireWeddingOwner(supabase, wid, user.id)

    if (!UuidSchema.safeParse(userId).success) {
      return err(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado.')
    }

    const { data: member, error: memberError } = await supabase
      .from('wedding_members')
      .select('role')
      .eq('wedding_id', wid)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError) return err(500, 'DB_ERROR', 'Erro ao verificar o membro.')
    if (!member) return err(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado.')
    if (member.role === 'owner') {
      return err(400, 'CANNOT_REMOVE_OWNER', 'O dono do casamento não pode ser removido.')
    }

    // wedding_members não tem policy de DELETE pro client autenticado (de propósito —
    // só o dono remove, e só por esta rota, que já confirmou a posse acima) — precisa
    // do client service role pra de fato executar o DELETE.
    const serviceSupabase = createSupabaseService()
    const { error: deleteError } = await serviceSupabase
      .from('wedding_members')
      .delete()
      .eq('wedding_id', wid)
      .eq('user_id', userId)

    if (deleteError) return err(500, 'DB_ERROR', 'Erro ao remover membro.')

    return ok({ user_id: userId })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid, userId } = await params

    await requireWeddingOwner(supabase, wid, user.id)

    if (!UuidSchema.safeParse(userId).success) {
      return err(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado.')
    }

    const rawBody = await req.json().catch(() => null)
    const parsedBody = UpdateMemberPermissionsSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsedBody.error.flatten())
    }

    const { data: member, error: memberError } = await supabase
      .from('wedding_members')
      .select('role')
      .eq('wedding_id', wid)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError) return err(500, 'DB_ERROR', 'Erro ao verificar o membro.')
    if (!member) return err(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado.')
    if (member.role === 'owner') {
      return err(400, 'CANNOT_EDIT_OWNER_PERMISSIONS', 'O papel do dono do casamento não pode ser alterado.')
    }

    // Mesmo motivo do DELETE acima: wedding_members não tem policy de UPDATE pro
    // client autenticado — só o dono altera permissões, e só por esta rota.
    const serviceSupabase = createSupabaseService()
    const { data: updated, error: updateError } = await serviceSupabase
      .from('wedding_members')
      .update({ permissions: parsedBody.data.permissions })
      .eq('wedding_id', wid)
      .eq('user_id', userId)
      .select('id, wedding_id, user_id, role, permissions, created_at')
      .single()

    if (updateError || !updated) return err(500, 'DB_ERROR', 'Erro ao atualizar permissões.')

    return ok(updated as WeddingMember)
  } catch (error) {
    return handleApiError(error)
  }
}
