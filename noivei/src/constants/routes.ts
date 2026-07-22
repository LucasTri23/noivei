// Rotas que não exigem autenticação — checadas por prefixo (`/rsvp/xyz` etc.) no
// middleware. Mantido em sincronia manual com a estrutura real de src/app; não é
// importado por mais nada além do middleware, então não afeta nenhuma outra tela se
// ficar desatualizado — só o comportamento de redirecionamento do middleware.
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/verify',
  '/forgot-password',
  '/rsvp',
  '/convite',
  '/auth/callback',
] as const

// Prefixos de primeiro nível que são de fato rotas do app (autenticadas) — usado só
// pra diferenciar de /[slug], o site público do casal, que também vive na raiz e não
// dá pra listar (é dinâmico). Qualquer pathname que não bata com PUBLIC_ROUTES nem
// com esta lista é tratado como /[slug] e deixado passar sem exigir login.
export const APP_ROUTE_PREFIXES = [
  '/dashboard', '/checklist', '/timeline', '/convidados', '/financeiro',
  '/mesas', '/site', '/arquivos', '/presentes', '/padrinhos', '/perfil',
  '/onboarding', '/admin',
] as const
