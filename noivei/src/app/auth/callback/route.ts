import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url    = new URL(request.url)
  const code   = url.searchParams.get('code')
  const next   = url.searchParams.get('next') ?? '/dashboard'
  const type   = url.searchParams.get('type')
  const origin = url.origin

  if (code) {
    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // Check if user already completed onboarding (has a wedding record)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: wedding } = await supabase
          .from('weddings')
          .select('id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()

        // New user — no wedding yet → onboarding
        if (!wedding) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
