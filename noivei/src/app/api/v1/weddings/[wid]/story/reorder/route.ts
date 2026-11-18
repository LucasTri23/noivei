import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { ReorderStorySchema } from '@/lib/api/validation/site-story.schema'
import { requireStoryAccess, storyDbErrorResponse } from '@/lib/site/story/story-api'

interface RouteContext {
  params: Promise<{ wid: string }>
}

// Recebe TODOS os ids (momentos ou fotos) na ordem final; a RPC confere que
// pertencem ao casamento e grava numa única transação.
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { wid } = await params
    const { supabase } = await requireStoryAccess(wid)

    const parsed = ReorderStorySchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const { error } = await supabase.rpc('fn_reorder_site_story', {
      p_wedding_id: wid,
      p_kind:       parsed.data.kind,
      p_ids:        parsed.data.ids,
    })
    if (error) return storyDbErrorResponse(error, 'Erro ao reordenar a história.')

    return ok(parsed.data)
  } catch (error) {
    return handleApiError(error)
  }
}
