export const ROUTES = {
  // Públicas
  HOME:           '/',
  LOGIN:          '/login',
  CADASTRO:       '/cadastro',
  VERIFICAR_EMAIL:'/verificar-email',
  ESQUECI_SENHA:  '/esqueci-senha',
  PLANOS:         '/planos',

  // App (autenticadas)
  ONBOARDING:     '/onboarding',
  DASHBOARD:      '/dashboard',
  CHECKLIST:      '/dashboard/checklist',
  TIMELINE:       '/dashboard/timeline',
  CONVIDADOS:     '/dashboard/convidados',
  FINANCEIRO:     '/dashboard/financeiro',
  FORNECEDORES:   '/dashboard/fornecedores',
  MESAS:          '/dashboard/mesas',
  SITE:           '/dashboard/site',
  ARQUIVOS:       '/dashboard/arquivos',
  CONFIGURACOES:  '/dashboard/configuracoes',

  // Admin
  ADMIN:          '/admin',
  ADMIN_USERS:    '/admin/usuarios',

  // API
  API: {
    HEALTH:     '/api/v1/health',
    WEDDINGS:   '/api/v1/weddings',
    BILLING:    '/api/v1/billing',
    WEBHOOKS:   '/api/v1/webhooks',
  },
} as const

// Rotas que não exigem autenticação
export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.CADASTRO,
  ROUTES.VERIFICAR_EMAIL,
  ROUTES.ESQUECI_SENHA,
  ROUTES.PLANOS,
  '/rsvp',
  '/convite',
  '/api/v1/health',
  '/api/v1/rsvp',
  '/api/v1/invites',
  '/api/v1/webhooks',
  '/api/v1/billing/plans',
] as const

// Rotas que exigem role admin
export const ADMIN_ROUTES = ['/admin'] as const
