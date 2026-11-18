// Hierarquia de categorias de fornecedor (migration 20261118000001):
// parent_id NULL = categoria principal (agrupador), parent_id preenchido =
// subcategoria — fornecedores só se vinculam a subcategorias.

export interface CategoryTreeInput {
  id:         string
  slug:       string
  label:      string
  parent_id?: string | null
  sort_order: number
}

export interface CategoryGroup<T extends CategoryTreeInput> {
  group:    T
  children: T[]
}

// Slugs que deixaram de existir como subcategoria ativa mas podem estar em URLs
// antigas (?categoria=beleza) — redirecionam para o grupo equivalente.
export const LEGACY_CATEGORY_SLUG_ALIASES: Readonly<Record<string, string>> = {
  beleza: 'beleza_estetica',
}

function bySortThenLabel(a: CategoryTreeInput, b: CategoryTreeInput): number {
  return a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'pt-BR')
}

/** Remove acentos e normaliza caixa/espaços para busca ("Decoração" ≈ "decoracao"). */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Agrupa uma lista plana em principal → subcategorias, ordenadas por sort_order.
 * Subcategorias cujo pai não está na lista (ex.: pai inativo filtrado pela RLS)
 * são descartadas.
 */
export function buildCategoryTree<T extends CategoryTreeInput>(categories: T[]): CategoryGroup<T>[] {
  const groups = categories.filter((c) => !c.parent_id).sort(bySortThenLabel)
  const childrenByParent = new Map<string, T[]>()

  for (const category of categories) {
    if (!category.parent_id) continue
    const list = childrenByParent.get(category.parent_id) ?? []
    list.push(category)
    childrenByParent.set(category.parent_id, list)
  }

  return groups.map((group) => ({
    group,
    children: (childrenByParent.get(group.id) ?? []).sort(bySortThenLabel),
  }))
}

/**
 * Filtra a árvore por texto: se o nome do grupo casa, o grupo inteiro aparece;
 * senão, só as subcategorias que casam. Grupos sem resultado somem.
 */
export function filterCategoryTree<T extends CategoryTreeInput>(
  tree:  CategoryGroup<T>[],
  query: string,
): CategoryGroup<T>[] {
  const term = normalizeSearchText(query)
  if (!term) return tree

  return tree
    .map(({ group, children }) => {
      if (normalizeSearchText(group.label).includes(term)) return { group, children }
      return { group, children: children.filter((c) => normalizeSearchText(c.label).includes(term)) }
    })
    .filter(({ children }) => children.length > 0)
}

export interface ResolvedCategoryFilter<T extends CategoryTreeInput> {
  /** Grupo principal ativo no filtro (o próprio, ou o pai da subcategoria). */
  group:       T | null
  /** Subcategoria escolhida, quando o filtro é de subcategoria. */
  subcategory: T | null
  /** IDs de subcategoria a usar na consulta de vínculos. */
  categoryIds: string[]
}

/**
 * Resolve o slug de `?categoria=` (principal, subcategoria ou alias legado) para
 * os IDs de subcategoria correspondentes. `null` quando o slug não existe.
 */
export function resolveCategoryFilter<T extends CategoryTreeInput>(
  categories: T[],
  slug:       string,
): ResolvedCategoryFilter<T> | null {
  const bySlug = (s: string) => categories.find((c) => c.slug === s)
  const match = bySlug(slug) ?? (LEGACY_CATEGORY_SLUG_ALIASES[slug] ? bySlug(LEGACY_CATEGORY_SLUG_ALIASES[slug]) : undefined)
  if (!match) return null

  if (match.parent_id) {
    const group = categories.find((c) => c.id === match.parent_id) ?? null
    return { group, subcategory: match, categoryIds: [match.id] }
  }

  const childIds = categories.filter((c) => c.parent_id === match.id).map((c) => c.id)
  return { group: match, subcategory: null, categoryIds: childIds }
}

/**
 * IDs de subcategoria cujo nome (ou o nome do grupo) contém o termo — usado pela
 * busca do marketplace para achar fornecedores pelo serviço que prestam.
 */
export function findCategoryIdsByText<T extends CategoryTreeInput>(categories: T[], text: string): string[] {
  const term = normalizeSearchText(text)
  if (term.length < 2) return []

  const matchingGroupIds = new Set(
    categories.filter((c) => !c.parent_id && normalizeSearchText(c.label).includes(term)).map((c) => c.id),
  )

  return categories
    .filter((c) => c.parent_id && (matchingGroupIds.has(c.parent_id) || normalizeSearchText(c.label).includes(term)))
    .map((c) => c.id)
}
