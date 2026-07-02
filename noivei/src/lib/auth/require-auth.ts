import type { User } from '@supabase/supabase-js'

import { ApiError } from '@/lib/api/response'
import { createSupabaseServer } from '@/lib/supabase/server'

// Lança ApiError(401) se não houver usuário autenticado na sessão.
export async function requireAuth(): Promise<{ user: User }> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Não autenticado.')
  }

  return { user: data.user }
}
