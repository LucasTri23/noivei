import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Cliente leve para uso exclusivo no middleware (não usa cookies() do next/headers)
// cookieOptions (secure/sameSite, sem httpOnly) precisa ficar em sincronia com
// server.ts e browser.ts — ver o comentário completo da decisão em browser.ts.
export function createSupabaseMiddleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: true, sameSite: 'lax' },
      cookies: {
        getAll: ()             => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  return { supabase, response }
}
