// Rotas que não exigem autenticação — checadas por prefixo (`/rsvp/xyz` etc.) no
// middleware. Mantido em sincronia manual com a estrutura real de src/app; não é
// importado por mais nada além do middleware, então não afeta nenhuma outra tela se
// ficar desatualizado — só o comportamento de redirecionamento do middleware.
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/verify',
  '/planos',
  '/forgot-password',
  '/reset-password',
  '/rsvp',
  '/ingresso',
  '/mural',
  '/convite',
  '/auth/callback',
] as const

// Prefixos de primeiro nível que são de fato rotas do app (autenticadas) — usado só
// pra diferenciar de /[slug], o site público do casal, que também vive na raiz e não
// dá pra listar (é dinâmico). Qualquer pathname que não bata com PUBLIC_ROUTES nem
// com esta lista é tratado como /[slug] e deixado passar sem exigir login (SEC-012:
// isso é fail-open por construção — inevitável dado que /[slug] é dinâmico). A
// proteção automatizada contra "rota nova esquecida aqui" é src/middleware.test.ts —
// ele falha se aparecer uma pasta nova em src/app/(app)/ sem prefixo correspondente
// nesta lista. Se esse teste quebrar, adicione o prefixo aqui antes do deploy.
export const APP_ROUTE_PREFIXES = [
  '/dashboard', '/checklist', '/timeline', '/convidados', '/financeiro',
  '/mesas', '/site', '/arquivos', '/presentes', '/padrinhos', '/checkin', '/album', '/perfil',
  '/onboarding', '/admin',
] as const
