// Endereço público do site do casal (/[slug]). O site vive na raiz do domínio, então
// um slug igual a uma rota real do app nunca seria alcançável — ficam reservados.
export const RESERVED_SITE_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'album', 'api', 'arquivos', 'auth', 'checkin', 'checklist', 'convidados', 'convite',
  'dashboard', 'financeiro', 'fonts', 'forgot-password', 'fornecedor', 'fornecedores', 'ingresso',
  'login', 'mesas', 'mural', 'onboarding', 'padrinhos', 'para-fornecedores', 'perfil', 'planos',
  'presentes', 'privacidade', 'profissionais', 'reset-password', 'rsvp', 'signup', 'site', 'termos',
  'timeline', 'verify',
])

export const SITE_SLUG_MAX_LENGTH = 60

export function isReservedSiteSlug(slug: string): boolean {
  return RESERVED_SITE_SLUGS.has(slug)
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Normaliza o que o casal digita no campo de endereço, enquanto digita: minúsculas,
 * sem acentos, espaços e símbolos viram hífen. Mantém um hífen no fim (o casal pode
 * estar no meio de "ana-e-"), que só sai em `finalizeSiteSlug`.
 */
export function normalizeSiteSlugInput(value: string): string {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .slice(0, SITE_SLUG_MAX_LENGTH)
}

/** Versão final do slug — sem hífens nas pontas. */
export function finalizeSiteSlug(value: string): string {
  return normalizeSiteSlugInput(value).replace(/-+$/, '')
}

/** Sugestão de endereço a partir do nome do casal ("Ana & João" → "ana-e-joao"). */
export function suggestSiteSlug(coupleNames: string): string {
  const slug = finalizeSiteSlug(coupleNames.replace(/[&+]/g, ' e '))
  if (slug.length < 3 || isReservedSiteSlug(slug)) return slug.length >= 3 ? `${slug}-casamento` : 'nosso-casamento'
  return slug
}

/** Alternativas para quando o endereço já está em uso: ana-e-joao-2, ana-e-joao-3… */
export function siteSlugAlternatives(slug: string, count = 5): string[] {
  const base = slug.slice(0, SITE_SLUG_MAX_LENGTH - 3)
  return Array.from({ length: count }, (_, index) => `${base}-${index + 2}`)
}

/** Resposta de GET /api/v1/weddings/[wid]/site/slug. */
export interface SlugAvailability {
  slug:        string
  available:   boolean
  message?:    string
  suggestion?: string
}
