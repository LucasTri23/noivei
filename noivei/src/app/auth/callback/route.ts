import { accountTypeForPath, requireAccountType } from '@/lib/auth/account-type'
import { ApiError } from '@/lib/api/response'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'

export async function GET(request: Request) {
  const url     = new URL(request.url)
  const code    = url.searchParams.get('code')
  const rawNext = url.searchParams.get('next')
  const type    = url.searchParams.get('type')
  const origin  = url.origin

  // `next` só é aceito se for um path relativo de verdade — sem isso, um valor tipo
  // "//evil.com" (protocol-relative) concatenado direto na URL de redirect vira um
  // open redirect (CWE-601). Hoje a concatenação simples de string já neutraliza um
  // "https://evil.com" completo, mas essa validação explícita não depende de
  // continuar sendo concatenação em vez de uma resolução de URL no futuro.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

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
        const accountType = accountTypeForPath(next)
        try { await requireAccountType(supabase, accountType) }
        catch (accountError) {
          await supabase.auth.signOut({ scope: 'local' })
          if (accountError instanceof ApiError && accountError.code === 'ACCOUNT_TYPE_CONFLICT') {
            return NextResponse.redirect(origin + '/login?next=' + encodeURIComponent(next) + '&error=account_type_conflict')
          }
          return NextResponse.redirect(origin + '/login?error=auth_callback_failed')
        }
        if (accountType === 'vendor') return NextResponse.redirect(origin + next)
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
