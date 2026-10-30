import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { ownAvatarPath } from '@/lib/vendor/avatar'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createSupabaseServer()
  // RLS: público só vê perfis publicados; o dono pode ver sua foto no cadastro.
  const { data: vendor, error } = await supabase.from('vendor_profiles').select('id, logo_storage_path').eq('slug', slug).maybeSingle()
  if (error || !vendor?.logo_storage_path || !ownAvatarPath(vendor.id, vendor.logo_storage_path)) return new Response(null, { status: 404 })
  const service = createSupabaseService()
  const { data, error: storageError } = await service.storage.from('vendor-portfolio').createSignedUrl(vendor.logo_storage_path, 300)
  if (storageError || !data?.signedUrl) return new Response(null, { status: 404 })
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store' } })
}
