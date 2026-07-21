import { requireModuleAccess, requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { UpdateSiteConfigSchema } from '@/lib/api/validation/site.schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { SiteConfig } from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const { data, error } = await supabase
      .from('site_config')
      .select('*')
      .eq('wedding_id', wid)
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao buscar configuração do site.')
    if (!data) return err(404, 'SITE_NOT_FOUND', 'Site ainda não configurado para este casamento.')

    return ok(data as SiteConfig)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwnership(supabase, wid, user.id)
    await requireModuleAccess(supabase, wid, user.id, 'site')

    const body = await parseJsonBody(req)
    const parsed = UpdateSiteConfigSchema.safeParse(body)
    if (!parsed.success) {
      return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())
    }

    const { data: existingData, error: fetchError } = await supabase
      .from('site_config')
      .select('id')
      .eq('wedding_id', wid)
      .maybeSingle()

    if (fetchError) return err(500, 'DB_ERROR', 'Erro ao buscar configuração do site.')

    if (!existingData) {
      if (!parsed.data.slug) {
        return err(400, 'SLUG_REQUIRED', 'Informe um slug para criar o site.')
      }

      const { data, error } = await supabase
        .from('site_config')
        .insert({
          wedding_id:      wid,
          slug:            parsed.data.slug,
          published:       parsed.data.published ?? false,
          cover_photo_url: parsed.data.cover_photo_url ?? null,
          content:         parsed.data.content ?? {},
        })
        .select()
        .single()

      if (error) {
        // UNIQUE(slug) global: slug já usado por outro casamento
        if (error.code === '23505') {
          return err(409, 'SLUG_TAKEN', 'Este slug já está em uso por outro site.')
        }
        return err(500, 'DB_ERROR', 'Erro ao criar configuração do site.')
      }

      return ok(data as SiteConfig, undefined, 201)
    }

    const { data, error } = await supabase
      .from('site_config')
      .update(parsed.data)
      .eq('wedding_id', wid)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return err(409, 'SLUG_TAKEN', 'Este slug já está em uso por outro site.')
      }
      return err(500, 'DB_ERROR', 'Erro ao salvar configuração do site.')
    }

    return ok(data as SiteConfig)
  } catch (error) {
    return handleApiError(error)
  }
}
