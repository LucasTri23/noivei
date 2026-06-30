import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseMiddleware }       from '@/lib/supabase/middleware'
import { PUBLIC_ROUTES, ADMIN_ROUTES }    from '@/constants/routes'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, response } = createSupabaseMiddleware(request)

  // Atualiza sessão — obrigatório para manter tokens frescos
  const { data: { user } } = await supabase.auth.getUser()

  // Rota pública — deixa passar
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  if (isPublic) return response

  // Rota de site público /[slug] — deixa passar
  if (isPublicSitePath(pathname)) return response

  // Não autenticado tentando acessar rota privada → /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Rota admin — verificar role
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route))
  if (isAdmin) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  return response
}

function isPublicSitePath(pathname: string): boolean {
  // /[slug] rotas de site de casamento são públicas
  // Exclui rotas de app conhecidas
  const appPaths = [
    '/dashboard', '/onboarding', '/admin', '/api',
    '/login', '/cadastro', '/planos', '/rsvp',
  ]
  return !appPaths.some((p) => pathname.startsWith(p)) && pathname !== '/'
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
