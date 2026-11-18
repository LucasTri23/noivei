import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { CreateStoryMomentSchema } from '@/lib/api/validation/site-story.schema'
import { requireStoryAccess, storyDbErrorResponse } from '@/lib/site/story/story-api'
import type { SiteStoryMoment } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { wid } = await params
    const { supabase } = await requireStoryAccess(wid)

    const parsed = CreateStoryMomentSchema.safeParse(await parseJsonBody(req))
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    // Novo momento entra no fim da lista do casal.
    const { data: last } = await supabase
      .from('site_story_moments')
      .select('sort_order')
      .eq('wedding_id', wid)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('site_story_moments')
      .insert({ ...parsed.data, wedding_id: wid, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
      .select()
      .single()

    if (error) return storyDbErrorResponse(error, 'Erro ao criar momento.')
    return ok(data as SiteStoryMoment, undefined, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
