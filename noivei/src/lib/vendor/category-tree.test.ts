import { describe, expect, it } from 'vitest'

import {
  buildCategoryTree,
  filterCategoryTree,
  findCategoryIdsByText,
  normalizeSearchText,
  resolveCategoryFilter,
  type CategoryTreeInput,
} from './category-tree'

const cat = (id: string, slug: string, label: string, parent_id: string | null, sort_order = 0): CategoryTreeInput =>
  ({ id, slug, label, parent_id, sort_order })

const catalog: CategoryTreeInput[] = [
  cat('g-foto', 'fotografia_audiovisual', 'Fotografia e audiovisual', null, 3),
  cat('g-gastro', 'gastronomia_bebidas', 'Gastronomia e bebidas', null, 0),
  cat('g-beleza', 'beleza_estetica', 'Beleza e estética', null, 2),
  cat('s-filmagem', 'filmagem', 'Filmagem', 'g-foto', 1),
  cat('s-foto', 'fotografia', 'Fotografia', 'g-foto', 0),
  cat('s-drone', 'drone', 'Drone', 'g-foto', 4),
  cat('s-buffet', 'buffet', 'Buffet', 'g-gastro', 0),
  cat('s-bolo', 'bolo', 'Bolos de casamento', 'g-gastro', 1),
  cat('s-maq', 'maquiagem', 'Maquiagem', 'g-beleza', 0),
  cat('s-orfa', 'orfa', 'Órfã de pai inativo', 'g-inexistente', 0),
]

describe('normalizeSearchText', () => {
  it('deve remover acentos, caixa e espaços extras', () => {
    expect(normalizeSearchText('  Decoração   de CERIMÔNIA ')).toBe('decoracao de cerimonia')
  })
})

describe('buildCategoryTree', () => {
  it('deve agrupar subcategorias sob a principal, ordenando ambos por sort_order', () => {
    const tree = buildCategoryTree(catalog)
    expect(tree.map((g) => g.group.slug)).toEqual(['gastronomia_bebidas', 'beleza_estetica', 'fotografia_audiovisual'])
    expect(tree[2]?.children.map((c) => c.slug)).toEqual(['fotografia', 'filmagem', 'drone'])
  })

  it('deve descartar subcategoria cujo pai não está na lista', () => {
    const allChildren = buildCategoryTree(catalog).flatMap((g) => g.children)
    expect(allChildren.some((c) => c.slug === 'orfa')).toBe(false)
  })
})

describe('filterCategoryTree', () => {
  const tree = buildCategoryTree(catalog)

  it('deve devolver a árvore inteira quando a busca está vazia', () => {
    expect(filterCategoryTree(tree, '  ')).toBe(tree)
  })

  it('deve manter só as subcategorias que casam, ignorando acentos', () => {
    const result = filterCategoryTree(tree, 'bolos')
    expect(result).toHaveLength(1)
    expect(result[0]?.children.map((c) => c.slug)).toEqual(['bolo'])
  })

  it('deve trazer o grupo inteiro quando o nome da principal casa', () => {
    const result = filterCategoryTree(tree, 'estetica')
    expect(result.map((g) => g.group.slug)).toEqual(['beleza_estetica'])
    expect(result[0]?.children.map((c) => c.slug)).toEqual(['maquiagem'])
  })

  it('deve devolver lista vazia quando nada casa', () => {
    expect(filterCategoryTree(tree, 'xyz')).toEqual([])
  })
})

describe('resolveCategoryFilter', () => {
  it('deve resolver slug de principal para todas as subcategorias dela', () => {
    const resolved = resolveCategoryFilter(catalog, 'fotografia_audiovisual')
    expect(resolved?.group?.id).toBe('g-foto')
    expect(resolved?.subcategory).toBeNull()
    expect(resolved?.categoryIds.sort()).toEqual(['s-drone', 's-filmagem', 's-foto'])
  })

  it('deve manter compatibilidade com slug antigo de subcategoria', () => {
    const resolved = resolveCategoryFilter(catalog, 'buffet')
    expect(resolved?.categoryIds).toEqual(['s-buffet'])
    expect(resolved?.group?.id).toBe('g-gastro')
  })

  it('deve redirecionar o alias legado "beleza" para o grupo Beleza e estética', () => {
    expect(resolveCategoryFilter(catalog, 'beleza')?.group?.slug).toBe('beleza_estetica')
  })

  it('deve devolver null para slug desconhecido', () => {
    expect(resolveCategoryFilter(catalog, 'nao_existe')).toBeNull()
  })
})

describe('findCategoryIdsByText', () => {
  it('deve achar subcategoria pelo nome do serviço', () => {
    expect(findCategoryIdsByText(catalog, 'drone')).toEqual(['s-drone'])
  })

  it('deve incluir todas as subcategorias quando o termo casa com a principal', () => {
    expect(findCategoryIdsByText(catalog, 'gastronomia').sort()).toEqual(['s-bolo', 's-buffet'])
  })

  it('deve ignorar termos com menos de 2 caracteres', () => {
    expect(findCategoryIdsByText(catalog, 'd')).toEqual([])
  })
})
