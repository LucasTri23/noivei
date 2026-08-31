import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateVendorPortfolioItemSchema } from '@/lib/api/validation/vendor.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorPortfolioItem } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Edita legenda/ordem do próprio item — nunca storage_path (trocar de arquivo é
// remover e subir de novo, ver POST acima). Usado pelos botões de mover pra
// cima/baixo do painel do fornecedor (Fase 6): o client manda os dois sort_order
// já trocados, um PATCH por item.
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    const { id } = await params

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Foto não encontrada.')
    }

    const body = await parseJsonBody(req)
    const parsed = UpdateVendorPortfolioItemSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data, error } = await supabase
      .from('vendor_portfolio_items')
      .update(parsed.data)
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao atualizar foto.')
    if (!data) return err(404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Foto não encontrada.')

    return ok(data as VendorPortfolioItem)
  } catch (error) {
    return handleApiError(error)
  }
}

// Remove uma foto do próprio portfólio — registro no banco E o objeto no Storage
// (mesmo padrão de limpeza dupla usado em DELETE /weddings/[wid]/album/photos/[id]).
// Diferente do bucket de álbum, "vendor-portfolio" tem policy de DELETE pro dono
// (fn_owns_vendor, ver migration 20260806000005), então o client autenticado normal
// já basta — não precisa de service role aqui.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    const { id } = await params

    if (!UuidSchema.safeParse(id).success) {
      return err(404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Foto não encontrada.')
    }

    const { data: item, error: fetchError } = await supabase
      .from('vendor_portfolio_items')
      .select('storage_path')
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar foto.')
    if (!item) return err(404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Foto não encontrada.')

    const { error: storageError } = await supabase.storage
      .from('vendor-portfolio')
      .remove([item.storage_path as string])

    if (storageError) return err(500, 'STORAGE_ERROR', 'Erro ao remover foto do armazenamento.')

    const { data, error } = await supabase
      .from('vendor_portfolio_items')
      .delete()
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .select('id')
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao remover registro da foto.')
    if (!data) return err(404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Foto não encontrada.')

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
