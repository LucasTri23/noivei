import { requireAuth } from '@/lib/auth/require-auth'
import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { createSupabaseServer } from '@/lib/supabase/server'
import { err, ok, handleApiError } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { avatarExtension, ownAvatarPath, VENDOR_AVATAR_MAX_BYTES } from '@/lib/vendor/avatar'

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    const limit = await checkRateLimit(supabase, 'vendor-avatar:' + user.id, 20, 3600)
    if (!limit.allowed) return err(429, 'RATE_LIMITED', 'Aguarde um pouco antes de enviar outra foto.')
    const file = (await req.formData()).get('photo')
    if (!(file instanceof File) || file.size === 0 || file.size > VENDOR_AVATAR_MAX_BYTES) return err(400, 'INVALID_PHOTO', 'Envie uma foto JPG, PNG ou WEBP de até 2 MB.')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const extension = avatarExtension(bytes, file.type)
    if (!extension) return err(400, 'INVALID_PHOTO', 'Formato de imagem inválido. Use JPG, PNG ou WEBP.')
    const path = vendor.id + '/' + crypto.randomUUID() + '-avatar.' + extension
    const storage = supabase.storage.from('vendor-portfolio')
    const { error: uploadError } = await storage.upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploadError) return err(500, 'UPLOAD_FAILED', 'Não foi possível enviar a foto.')
    const { error } = await supabase.from('vendor_profiles').update({ logo_storage_path: path }).eq('id', vendor.id)
    if (error) {
      await storage.remove([path])
      return err(500, 'DB_ERROR', 'Não foi possível salvar a foto.')
    }
    if (vendor.logo_storage_path && ownAvatarPath(vendor.id, vendor.logo_storage_path)) await storage.remove([vendor.logo_storage_path])
    return ok({ avatar_url: '/api/v1/vendors/' + vendor.slug + '/avatar?v=' + Date.now() })
  } catch (error) { return handleApiError(error) }
}

export async function DELETE() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const vendor = await requireVendorProfile(supabase, user.id)
    const { error } = await supabase.from('vendor_profiles').update({ logo_storage_path: null }).eq('id', vendor.id)
    if (error) return err(500, 'DB_ERROR', 'Não foi possível remover a foto.')
    if (vendor.logo_storage_path && ownAvatarPath(vendor.id, vendor.logo_storage_path)) await supabase.storage.from('vendor-portfolio').remove([vendor.logo_storage_path])
    return ok({ removed: true })
  } catch (error) { return handleApiError(error) }
}
