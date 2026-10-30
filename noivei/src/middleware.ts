import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseMiddleware }       from '@/lib/supabase/middleware'
import { PUBLIC_ROUTES, APP_ROUTE_PREFIXES } from '@/constants/routes'

// Checagem de role admin não acontece aqui de propósito — vive só em
// src/app/(admin)/admin/layout.tsx (profiles.role, com notFound() em vez de 403 pra
// não revelar a existência do painel a quem não é admin). Duplicar a checagem aqui
// com uma resposta diferente (403 JSON) quebraria essa escolha de privacidade.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  request.headers.set('x-pathname', pathname)
  const session = createSupabaseMiddleware(request)
  const { supabase } = session

  // Next.js não expõe pathname pra Server Components de layout — só pra Client
  // Components via usePathname(). src/app/(vendor)/layout.tsx precisa saber se já
  // está em /fornecedor/cadastro pra não fazer loop de redirect (fornecedor sem
  // perfil ainda: layout manda pra /fornecedor/cadastro, mas a própria página do
  // wizard não pode se autorredirecionar). Header próprio, lido via headers() do
  // lado do servidor — padrão comum pra esse gap do App Router.
  // O pathname é encaminhado nos headers da requisição.

  // Atualiza sessão — obrigatório para manter tokens frescos
  const { data: { user } } = await supabase.auth.getUser()

  const response = session.response

  // Rotas de API sempre passam — cada uma já faz sua própria checagem de auth
  // (requireAuth/requireAdmin) e responde com JSON de erro; redirecionar uma
  // chamada fetch() para uma página HTML de login não faz sentido.
  if (pathname.startsWith('/api/')) return response

  // Rota pública — deixa passar
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  if (isPublic) return response

  // Não é uma rota conhecida do app (autenticada) nem pública — é /[slug], o site
  // público do casal (rota dinâmica na raiz, impossível de listar) — deixa passar.
  const isAppRoute = APP_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  if (!isAppRoute) return response

  // Não autenticado tentando acessar rota privada → /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
