import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente com service role — contorna RLS. Uso restrito a fluxos públicos por
// token (ex: RSVP), onde não há usuário autenticado. Nunca importar no browser.
export function createSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias para o client service role.',
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
