import { ok, handleApiError } from '@/lib/api/response'
import { loadStoryRecords } from '@/lib/site/story/load-story'
import { requireStoryAccess } from '@/lib/site/story/story-api'

interface RouteContext {
  params: Promise<{ wid: string }>
}

// Momentos e fotos da história para o editor (/site).
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { wid } = await params
    const { supabase } = await requireStoryAccess(wid)
    return ok(await loadStoryRecords(supabase, wid))
  } catch (error) {
    return handleApiError(error)
  }
}
