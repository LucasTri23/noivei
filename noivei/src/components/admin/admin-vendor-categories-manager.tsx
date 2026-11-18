'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Modal from '@/components/ui/modal'
import ToggleSwitch from '@/components/ui/toggle-switch'
import { buildCategoryTree, filterCategoryTree, normalizeSearchText } from '@/lib/vendor/category-tree'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorCategory } from '@/types/database'

export type AdminVendorCategoryRow = VendorCategory & { vendor_count: number }

interface AdminVendorCategoriesManagerProps {
  initialCategories: AdminVendorCategoryRow[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function slugFromLabel(label: string): string {
  const slug = normalizeSearchText(label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
  return /^[a-z]/.test(slug) ? slug : slug ? `c_${slug}`.slice(0, 50) : ''
}

type FormState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; category: AdminVendorCategoryRow }

const COLORS = { fg: '#3C2818', muted: '#6B5B47', accent: '#8A5A2E', border: '#F0E6D8', soft: '#F4EFE7', danger: '#C0553F' }

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '10px 13px', fontSize: '14px', outline: 'none',
}
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: COLORS.fg, display: 'block', marginBottom: '6px' }
const iconButtonStyle: React.CSSProperties = {
  minWidth: '34px', minHeight: '34px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', background: '#fff',
  color: COLORS.accent, cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: '0 10px',
}

export default function AdminVendorCategoriesManager({ initialCategories }: AdminVendorCategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [query, setQuery]           = useState('')
  const [form, setForm]             = useState<FormState | null>(null)
  const [label, setLabel]           = useState('')
  const [slug, setSlug]             = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [parentId, setParentId]     = useState<string>('')
  const [saving, setSaving]         = useState(false)

  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const visibleTree = useMemo(() => {
    const filtered = filterCategoryTree(tree, query)
    // Grupo cujo nome casa mas ainda sem filhas também deve aparecer.
    if (!query.trim()) return tree
    const term = normalizeSearchText(query)
    const emptyMatches = tree.filter((g) => g.children.length === 0 && normalizeSearchText(g.group.label).includes(term))
    return [...filtered, ...emptyMatches]
  }, [tree, query])
  const groups = tree.map((g) => g.group)

  function replaceCategory(updated: VendorCategory) {
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
  }

  async function patchCategory(id: string, payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/v1/admin/vendor-categories/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar a categoria.'))
      return false
    }
    const body = (await res.json()) as { data: VendorCategory }
    replaceCategory(body.data)
    return true
  }

  async function move(siblings: AdminVendorCategoryRow[], index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= siblings.length) return

    const ids = siblings.map((c) => c.id)
    ;[ids[index], ids[target]] = [ids[target] as string, ids[index] as string]
    const previous = categories

    setCategories((prev) => prev.map((c) => {
      const pos = ids.indexOf(c.id)
      return pos === -1 ? c : { ...c, sort_order: pos }
    }))

    const res = await fetch('/api/v1/admin/vendor-categories/reorder', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids }),
    })
    if (!res.ok) {
      setCategories(previous)
      toastError(await readApiError(res, 'Não foi possível reordenar.'))
    }
  }

  async function remove(category: AdminVendorCategoryRow) {
    if (!window.confirm(`Excluir a categoria "${category.label}"? Essa ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/v1/admin/vendor-categories/${category.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível excluir a categoria.'))
      return
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id))
    toastSuccess('Categoria excluída.')
  }

  function openCreate(parent: string | null) {
    setForm({ mode: 'create', parentId: parent })
    setLabel(''); setSlug(''); setSlugTouched(false); setDescription(''); setParentId(parent ?? '')
  }

  function openEdit(category: AdminVendorCategoryRow) {
    setForm({ mode: 'edit', category })
    setLabel(category.label); setSlug(category.slug); setSlugTouched(true)
    setDescription(category.description ?? ''); setParentId(category.parent_id ?? '')
  }

  async function submitForm() {
    if (!form) return
    if (!label.trim()) { toastError('Informe o nome.'); return }

    setSaving(true)
    try {
      if (form.mode === 'edit') {
        const payload: Record<string, unknown> = { label: label.trim(), description: description.trim() || null }
        // Só subcategorias trocam de principal pela tela (principal continua principal).
        if (form.category.parent_id && parentId && parentId !== form.category.parent_id) payload.parent_id = parentId
        if (await patchCategory(form.category.id, payload)) {
          toastSuccess('Categoria atualizada.')
          setForm(null)
        }
        return
      }

      const finalSlug = slug.trim() || slugFromLabel(label)
      if (!finalSlug) { toastError('Informe o identificador.'); return }
      const siblings = categories.filter((c) => (c.parent_id ?? '') === parentId)
      const res = await fetch('/api/v1/admin/vendor-categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          slug:        finalSlug,
          label:       label.trim(),
          description: description.trim() || null,
          parent_id:   parentId || null,
          sort_order:  siblings.length ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 0,
        }),
      })
      if (!res.ok) {
        toastError(await readApiError(res, 'Não foi possível criar a categoria.'))
        return
      }
      const body = (await res.json()) as { data: VendorCategory }
      setCategories((prev) => [...prev, { ...body.data, vendor_count: 0 }])
      setForm(null)
      toastSuccess('Categoria criada.')
    } finally {
      setSaving(false)
    }
  }

  function renderActions(category: AdminVendorCategoryRow, siblings: AdminVendorCategoryRow[], index: number, hasChildren: boolean) {
    const deletable = category.vendor_count === 0 && !hasChildren
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <button type="button" style={iconButtonStyle} onClick={() => move(siblings, index, -1)} disabled={index === 0} aria-label={`Mover ${category.label} para cima`}>↑</button>
        <button type="button" style={iconButtonStyle} onClick={() => move(siblings, index, 1)} disabled={index === siblings.length - 1} aria-label={`Mover ${category.label} para baixo`}>↓</button>
        <button type="button" style={iconButtonStyle} onClick={() => openEdit(category)}>Editar</button>
        <button
          type="button"
          style={{ ...iconButtonStyle, color: deletable ? COLORS.danger : '#B8A894', cursor: deletable ? 'pointer' : 'not-allowed' }}
          onClick={() => remove(category)}
          disabled={!deletable}
          title={deletable ? 'Excluir' : 'Categorias com fornecedores ou subcategorias não podem ser excluídas — desative'}
        >
          Excluir
        </button>
      </div>
    )
  }

  return (
    <div>
      <Link href="/admin/fornecedores" style={{ fontSize: '13px', color: COLORS.accent, textDecoration: 'none' }}>← Fornecedores</Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'baseline', justifyContent: 'space-between', margin: '10px 0 16px' }}>
        <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: COLORS.fg, margin: 0 }}>Categorias de fornecedor</h1>
        <button
          type="button"
          onClick={() => openCreate(null)}
          style={{ border: 'none', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '13.5px', background: COLORS.accent, color: '#fff', cursor: 'pointer' }}
        >
          + Nova categoria principal
        </button>
      </div>

      <p style={{ fontSize: '13px', color: COLORS.muted, margin: '0 0 14px', lineHeight: 1.6 }}>
        Fornecedores se vinculam às subcategorias. Desativar esconde a categoria do cadastro e do marketplace sem apagar os
        vínculos existentes. Só é possível excluir categorias sem fornecedores e sem subcategorias.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar categoria…"
        aria-label="Buscar categoria"
        style={{ ...inputStyle, maxWidth: '360px', marginBottom: '16px', background: '#fff' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {visibleTree.map(({ group, children }) => {
          const groupSiblings = tree.map((g) => g.group)
          const groupIndex = groupSiblings.findIndex((g) => g.id === group.id)
          const allChildren = tree.find((g) => g.group.id === group.id)?.children ?? []
          const totalVendors = allChildren.reduce((sum, c) => sum + c.vendor_count, 0)

          return (
            <section key={group.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(60,40,24,0.06)' }}>
              <header style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: COLORS.soft }}>
                <div style={{ minWidth: '200px', flex: '1 1 240px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.fg, margin: 0 }}>{group.label}</h2>
                  <p style={{ fontSize: '12.5px', color: COLORS.muted, margin: '2px 0 0' }}>
                    {group.slug} · {allChildren.length} subcategorias · {totalVendors} vínculo(s) de fornecedor
                  </p>
                </div>
                <ToggleSwitch checked={group.active} onChange={() => patchCategory(group.id, { active: !group.active })} label={group.active ? 'Ativa' : 'Inativa'} />
                {renderActions(group, groupSiblings, groupIndex, allChildren.length > 0)}
                <button type="button" style={iconButtonStyle} onClick={() => openCreate(group.id)}>+ Subcategoria</button>
              </header>

              {children.length === 0 && (
                <p style={{ padding: '12px 16px', fontSize: '13px', color: COLORS.muted, margin: 0 }}>Nenhuma subcategoria.</p>
              )}

              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {children.map((category) => {
                  const index = allChildren.findIndex((c) => c.id === category.id)
                  return (
                    <li key={category.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: category.active ? COLORS.fg : '#B8A894', margin: 0 }}>{category.label}</p>
                        <p style={{ fontSize: '12px', color: COLORS.muted, margin: '2px 0 0' }}>
                          {category.slug} · {category.vendor_count} fornecedor(es)
                          {category.description ? ` · ${category.description}` : ''}
                        </p>
                      </div>
                      <ToggleSwitch checked={category.active} onChange={() => patchCategory(category.id, { active: !category.active })} label={category.active ? 'Ativa' : 'Inativa'} />
                      {renderActions(category, allChildren, index, false)}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {visibleTree.length === 0 && (
          <p style={{ fontSize: '13.5px', color: COLORS.muted }}>Nenhuma categoria encontrada.</p>
        )}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.mode === 'edit' ? 'Editar categoria' : parentId ? 'Nova subcategoria' : 'Nova categoria principal'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="vc-label" style={labelStyle}>Nome</label>
            <input
              id="vc-label"
              style={inputStyle}
              value={label}
              maxLength={80}
              onChange={(e) => {
                setLabel(e.target.value)
                if (form?.mode === 'create' && !slugTouched) setSlug(slugFromLabel(e.target.value))
              }}
              placeholder="Ex: Cerimonial"
            />
          </div>

          <div>
            <label htmlFor="vc-slug" style={labelStyle}>Identificador (slug)</label>
            <input
              id="vc-slug"
              style={{ ...inputStyle, background: form?.mode === 'edit' ? COLORS.soft : '#fff' }}
              value={slug}
              readOnly={form?.mode === 'edit'}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true) }}
              placeholder="Ex: cerimonial"
            />
            <p style={{ fontSize: '12px', color: COLORS.muted, margin: '4px 0 0' }}>
              {form?.mode === 'edit' ? 'O identificador não muda depois de criado (é usado em links e filtros).' : 'Letras minúsculas, números e "_".'}
            </p>
          </div>

          <div>
            <label htmlFor="vc-description" style={labelStyle}>Descrição (opcional)</label>
            <textarea id="vc-description" style={inputStyle} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Principal escolhida na criação; na edição só subcategorias podem mudar de grupo. */}
          {(form?.mode === 'create' ? form.parentId !== null : Boolean(form?.category.parent_id)) && (
            <div>
              <label htmlFor="vc-parent" style={labelStyle}>Categoria principal</label>
              <select id="vc-parent" style={inputStyle} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.label}{g.active ? '' : ' (inativa)'}</option>)}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={submitForm}
            disabled={saving}
            style={{ border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, fontSize: '14px', background: COLORS.accent, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Salvando…' : form?.mode === 'edit' ? 'Salvar' : 'Criar categoria'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
