'use client'

import Link from 'next/link'
import { useState } from 'react'
import Modal from '@/components/ui/modal'
import ToggleSwitch from '@/components/ui/toggle-switch'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorCategory } from '@/types/database'

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

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '10px 13px', fontSize: '14px', outline: 'none',
}

export default function AdminVendorCategoriesManager({ initialCategories }: { initialCategories: VendorCategory[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [modalOpen, setModalOpen]   = useState(false)
  const [slug, setSlug]             = useState('')
  const [label, setLabel]           = useState('')
  const [saving, setSaving]         = useState(false)

  async function toggleActive(category: VendorCategory) {
    const res = await fetch(`/api/v1/admin/vendor-categories/${category.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !category.active }),
    })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar a categoria.'))
      return
    }
    const body = (await res.json()) as { data: VendorCategory }
    setCategories((prev) => prev.map((c) => (c.id === category.id ? body.data : c)))
  }

  async function createCategory() {
    if (!slug.trim() || !label.trim()) {
      toastError('Preencha identificador e nome.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/v1/admin/vendor-categories', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slug: slug.trim(), label: label.trim(), sort_order: categories.length }),
    })
    setSaving(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar a categoria.'))
      return
    }
    const body = (await res.json()) as { data: VendorCategory }
    setCategories((prev) => [...prev, body.data])
    setModalOpen(false)
    setSlug('')
    setLabel('')
    toastSuccess('Categoria criada.')
  }

  return (
    <div>
      <Link href="/admin/fornecedores" style={{ fontSize: '13px', color: '#8A5A2E', textDecoration: 'none' }}>← Fornecedores</Link>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '10px 0 20px' }}>
        <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: '#3C2818', margin: 0 }}>Categorias de fornecedor</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{ border: 'none', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '13.5px', background: '#8A5A2E', color: '#fff', cursor: 'pointer' }}
        >
          + Nova categoria
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(60,40,24,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#F4EFE7', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Nome</th>
              <th style={{ padding: '12px 16px' }}>Identificador</th>
              <th style={{ padding: '12px 16px' }}>Ordem</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} style={{ borderTop: '1px solid #F0E6D8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#3C2818' }}>{category.label}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{category.slug}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{category.sort_order}</td>
                <td style={{ padding: '12px 16px' }}>
                  <ToggleSwitch checked={category.active} onChange={() => toggleActive(category)} label={category.active ? 'Ativa' : 'Inativa'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova categoria">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }}>Nome</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Cerimonial" />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }}>Identificador (slug)</label>
            <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="Ex: cerimonial" />
          </div>
          <button
            type="button"
            onClick={createCategory}
            disabled={saving}
            style={{ border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, fontSize: '14px', background: '#8A5A2E', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Criando…' : 'Criar categoria'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
