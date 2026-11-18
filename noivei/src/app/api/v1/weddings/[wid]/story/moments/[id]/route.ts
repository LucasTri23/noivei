import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UuidSchema } from '@/lib/api/validation/common.schema'
import { UpdateStoryMomentSchema } from '@/lib/api/validation/site-story.schema'
import { requireStoryAccess, storyDbErrorResponse } from '@/lib/site/story/story-api'
import type { SiteStoryMoment } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string; id: string }>
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { wid, id } = await params
    const { supabase } = await requireStoryAccess(wid)
    if (!UuidSchema.safeParse(id).success) return err(404, 'MOMENT_NOT_FOUND', 'Momento não encontrado.')

    const parsed = UpdateStoryMomentSchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const { data, error } = await supabase
      .from('site_story_moments')
      .update(parsed.data)
      .eq('id', id)
      .eq('wedding_id', wid)
      .select()
      .maybeSingle()

    if (error) return storyDbErrorResponse(error, 'Erro ao atualizar momento.')
    if (!data) return err(404, 'MOMENT_NOT_FOUND', 'Momento não encontrado.')
    return ok(data as SiteStoryMoment)
  } catch (error) {
    return handleApiError(error)
  }
}

// As fotos do momento continuam na história (a FK desvincula com SET NULL) —
// excluir um momento nunca apaga fotografias.
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { wid, id } = await params
    const { supabase } = await requireStoryAccess(wid)
    if (!UuidSchema.safeParse(id).success) return err(404, 'MOMENT_NOT_FOUND', 'Momento não encontrado.')

    const { data, error } = await supabase
      .from('site_story_moments')
      .delete()
      .eq('id', id)
      .eq('wedding_id', wid)
      .select('id')
      .maybeSingle()

    if (error) return storyDbErrorResponse(error, 'Erro ao excluir momento.')
    if (!data) return err(404, 'MOMENT_NOT_FOUND', 'Momento não encontrado.')
    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
