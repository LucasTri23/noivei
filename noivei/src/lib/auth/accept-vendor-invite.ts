import type { SupabaseClient } from '@supabase/supabase-js'

/** Convites administrativos usam tokens no fragmento, sem o verificador PKCE. */
export async function acceptVendorInvite(
  url: URL,
  clearFragment: () => void,
  getSupabase: () => SupabaseClient,
): Promise<boolean | null> {
  const params = new URLSearchParams(url.hash.slice(1))
  const isInvite = params.get('type') === 'invite'
  const inviteError = url.searchParams.get('next') === '/fornecedor' && params.has('error')
  if (!isInvite && !inviteError) return null
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  // Remove os tokens antes de inicializar o client PKCE e antes de navegar.
  clearFragment()
  if (!isInvite || !accessToken || !refreshToken) return false
  try {
    const { data, error } = await getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    return !error && Boolean(data.user)
  } catch { return false }
}
