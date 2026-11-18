'use client'

import { useId, useMemo, useState } from 'react'

import { buildCategoryTree, filterCategoryTree, type CategoryTreeInput } from '@/lib/vendor/category-tree'

interface VendorCategoryPickerProps {
  /** Lista plana com principais e subcategorias ativas. */
  categories:  CategoryTreeInput[]
  selectedIds: string[]
  onToggle:    (categoryId: string) => void
  /** Limite de subcategorias (mesmo teto da RPC fn_admin_create_vendor). */
  maxSelected?: number
  disabled?:    boolean
  error?:       string | null
}

// Cores via variáveis do tema com fallback — o wizard roda dentro do tema do
// fornecedor (--wedding-color) e o admin usa a paleta fixa marrom.
const ACCENT        = 'var(--wedding-color, #8A5A2E)'
const ACCENT_SUBTLE = 'var(--wedding-color-subtle, #F4EFE7)'
const ACCENT_DARK   = 'var(--wedding-color-dark, #5A3A1E)'
const BORDER        = '#EBDDD0'
const MUTED         = 'var(--muted-fg, #6B5B47)'
const FG            = 'var(--fg, #3C2818)'
const SURFACE       = 'var(--surface, #fff)'

export default function VendorCategoryPicker({
  categories, selectedIds, onToggle, maxSelected = 20, disabled = false, error,
}: VendorCategoryPickerProps) {
  const baseId = useId()
  const [query, setQuery] = useState('')
  const tree = useMemo(() => buildCategoryTree(categories).filter((g) => g.children.length > 0), [categories])
  const visibleTree = useMemo(() => filterCategoryTree(tree, query), [tree, query])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  // Só conta o que está visível no catálogo: um vínculo antigo com categoria
  // desativada continua salvo, mas não aparece aqui.
  const selectedCategories = useMemo(
    () => tree.flatMap((g) => g.children).filter((c) => selectedSet.has(c.id)),
    [tree, selectedSet],
  )

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(tree.filter((g) => g.children.some((c) => selectedIds.includes(c.id))).map((g) => g.group.id)),
  )
  const searching = query.trim().length > 0
  const limitReached = selectedCategories.length >= maxSelected

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div>
      <label htmlFor={`${baseId}-search`} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: FG, marginBottom: '6px' }}>
        Buscar categoria
      </label>
      <input
        id={`${baseId}-search`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex: fotografia, convites, DJ…"
        autoComplete="off"
        style={{
          width: '100%', border: `1.5px solid ${BORDER}`, borderRadius: '12px', padding: '11px 13px',
          fontSize: '14px', color: FG, background: SURFACE, marginBottom: '12px',
        }}
      />

      <div aria-live="polite" style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: selectedCategories.length ? ACCENT_DARK : MUTED, margin: '0 0 8px' }}>
          {selectedCategories.length === 0
            ? 'Nenhuma categoria selecionada'
            : `${selectedCategories.length} ${selectedCategories.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}`}
          {limitReached && ` (máximo de ${maxSelected})`}
        </p>
        {selectedCategories.length > 0 && (
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', listStyle: 'none', padding: 0, margin: 0 }}>
            {selectedCategories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(category.id)}
                  aria-label={`Remover ${category.label}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '32px',
                    border: 'none', borderRadius: '999px', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600,
                    background: ACCENT_SUBTLE, color: ACCENT_DARK, cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {category.label}
                  <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden', background: SURFACE }}>
        {visibleTree.length === 0 && (
          <p style={{ padding: '16px', fontSize: '13.5px', color: MUTED, margin: 0 }}>
            Nenhuma categoria encontrada para “{query.trim()}”. Se o seu serviço não estiver na lista, use
            “Outros serviços para casamentos”.
          </p>
        )}

        {visibleTree.map(({ group, children }, index) => {
          const open = searching || openGroups.has(group.id)
          const panelId = `${baseId}-group-${group.id}`
          const selectedInGroup = children.filter((c) => selectedSet.has(c.id)).length

          return (
            <section key={group.id} style={{ borderTop: index === 0 ? 'none' : `1px solid ${BORDER}` }}>
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => { if (!searching) toggleGroup(group.id) }}
                  style={{
                    width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left',
                    cursor: searching ? 'default' : 'pointer', color: FG, fontSize: '14px', fontWeight: 700,
                  }}
                >
                  <span style={{ flex: 1 }}>{group.label}</span>
                  {selectedInGroup > 0 && (
                    <span style={{ fontSize: '11.5px', fontWeight: 700, borderRadius: '999px', padding: '2px 8px', background: ACCENT, color: '#fff' }}>
                      {selectedInGroup}
                    </span>
                  )}
                  <span aria-hidden="true" style={{ color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                </button>
              </h3>

              {open && (
                <div id={panelId} role="group" aria-label={group.label} className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '4px', padding: '0 10px 12px' }}>
                  {children.map((category) => {
                    const checked = selectedSet.has(category.id)
                    const blocked = disabled || (!checked && limitReached)
                    return (
                      <label
                        key={category.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '8px 10px',
                          borderRadius: '10px', fontSize: '13.5px', cursor: blocked ? 'not-allowed' : 'pointer',
                          background: checked ? ACCENT_SUBTLE : 'transparent',
                          color: checked ? ACCENT_DARK : FG, fontWeight: checked ? 700 : 500, opacity: blocked && !checked ? 0.55 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => onToggle(category.id)}
                          style={{ width: '18px', height: '18px', accentColor: ACCENT, flexShrink: 0 }}
                        />
                        {category.label}
                      </label>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {error && <p role="alert" style={{ color: '#C0553F', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
    </div>
  )
}
