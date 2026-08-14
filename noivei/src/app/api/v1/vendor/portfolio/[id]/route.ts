import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
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
