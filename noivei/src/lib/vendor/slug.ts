import type { SupabaseClient } from '@supabase/supabase-js'

// Mesma técnica de sanitização de sanitizeFileName (src/lib/files/upload-wedding-file.ts):
// NFKD decompõe acentos em letra base + diacrítico; o diacrítico sobra como caractere
// não-alfanumérico e é engolido pelo próprio collapse de "-" abaixo — não precisa de
// um passo separado pra remover diacríticos. Resultado sempre em minúsculas, um único
// hífen entre palavras, sem hífen nas pontas.
export function slugifyBusinessName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

  return slug || 'fornecedor'
}

/**
 * Gera um slug único pra um novo vendor_profiles a partir do nome da empresa.
 *
 * A pré-checagem abaixo é best-effort, não a garantia real de unicidade: a RLS de
 * vendor_profiles só deixa este usuário enxergar a PRÓPRIA linha (ainda nenhuma,
 * neste ponto) e fornecedores com status='active' publicamente visíveis — um
 * conflito contra o slug de outro fornecedor em 'draft'/'pending_review' é invisível
 * aqui. A garantia de verdade é o UNIQUE(slug) da tabela + retry no 23505 de quem
 * chama esta function no INSERT (ver POST /api/v1/vendor/profile) — mesmo padrão
 * "pré-checagem + retry na constraint" já usado pra slug de site_config, só que lá o
 * slug é digitado pelo casal (409 direto); aqui é gerado por nós, então o produto
 * certo é já entregar um candidato improvável de colidir, não devolver erro.
 */
export async function generateUniqueVendorSlug(
  supabase: SupabaseClient,
  businessName: string,
): Promise<string> {
  const base = slugifyBusinessName(businessName)

  const { data: existing } = await supabase
    .from('vendor_profiles')
    .select('slug')
    .or(`slug.eq.${base},slug.like.${base}-%`)

  const taken = new Set(((existing ?? []) as { slug: string }[]).map((row) => row.slug))
  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/**
 * Próximo candidato de slug depois de um 23505 real detectado no INSERT (corrida
 * contra um fornecedor cujo slug a RLS não deixou a pré-checagem enxergar) — sufixo
 * aleatório curto em vez de incrementar sequencialmente, já que não dá pra saber
 * quais números já foram tentados por quem não conseguimos ver.
 */
export function nextSlugCandidate(base: string): string {
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}
