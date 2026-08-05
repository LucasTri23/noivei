import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import type { Database }      from '@/types/database'

// Cliente para Server Components, API Routes e Server Actions
// cookieOptions (secure/sameSite, sem httpOnly) precisa ficar em sincronia com
// browser.ts e middleware.ts — ver o comentário completo da decisão em browser.ts.
export async function createSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: true, sameSite: 'lax' },
      cookies: {
        getAll: ()                     => cookieStore.getAll(),
        setAll: (cookiesToSet)         => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component: cookies são read-only — ignorar
          }
        },
      },
    },
  )
}
