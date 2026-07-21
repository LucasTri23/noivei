import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'

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

      // Check if user already has access to a wedding — dono OU membro convidado
      // (getUserWedding, ao contrário da query antiga em weddings.user_id, também
      // encontra o casamento de quem acabou de aceitar um convite)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const wedding = await getUserWedding(supabase, user.id)

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
