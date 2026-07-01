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
      const redirectTo = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
