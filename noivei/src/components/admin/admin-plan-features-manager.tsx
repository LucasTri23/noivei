'use client'

import { useState } from 'react'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { PlanFeature, PlanFeatureCategory, PlanFeatureValue, PlanGroupKey } from '@/types/database'

interface AdminPlanFeaturesManagerProps {
  initialCategories: PlanFeatureCategory[]
  initialFeatures:   PlanFeature[]
  initialValues:     PlanFeatureValue[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

const GROUPS: { key: PlanGroupKey; label: string }[] = [
  { key: 'free', label: 'Gratuito' },
  { key: 'premium', label: 'Premium' },
  { key: 'plus', label: 'Premium Plus' },
]

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '10px', padding: '8px 10px',
  fontSize: '13.5px', color: '#2A1E10', background: '#FFFFFF', outline: 'none', width: '100%',
}

export default function AdminPlanFeaturesManager({ initialCategories, initialFeatures, initialValues }: AdminPlanFeaturesManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [features, setFeatures]     = useState(initialFeatures)
  const [cellValues, setCellValues] = useState<Record<string, string>>(
    Object.fromEntries(initialValues.map((v) => [`${v.feature_id}:${v.group_key}`, v.value])),
  )
  const [newFeatureLabel, setNewFeatureLabel] = useState<Record<string, string>>({})
  const [newCategoryTitle, setNewCategoryTitle] = useState('')

  async function saveCell(featureId: string, groupKey: PlanGroupKey, value: string) {
    const res = await fetch('/api/v1/admin/plan-features/values', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_id: featureId, group_key: groupKey, value }),
    })
    if (!res.ok) toastError(await readApiError(res, 'Não foi possível salvar essa célula.'))
  }

  async function addCategory() {
    if (!newCategoryTitle.trim()) return
    const res = await fetch('/api/v1/admin/plan-features/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newCategoryTitle.trim(), sort_order: categories.length }),
    })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível criar a categoria.')); return }
    const { data } = (await res.json()) as { data: PlanFeatureCategory }
    setCategories((prev) => [...prev, data])
    setNewCategoryTitle('')
    toastSuccess('Categoria criada.')
  }

  async function deleteCategory(id: string) {
    if (!window.confirm('Remover esta categoria e todas as suas linhas?')) return
    const res = await fetch(`/api/v1/admin/plan-features/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível remover a categoria.')); return }
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setFeatures((prev) => prev.filter((f) => f.category_id !== id))
  }

  async function addFeature(categoryId: string) {
    const label = (newFeatureLabel[categoryId] ?? '').trim()
    if (!label) return
    const count = features.filter((f) => f.category_id === categoryId).length
    const res = await fetch('/api/v1/admin/plan-features/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, label, sort_order: count }),
    })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível criar a linha.')); return }
    const { data } = (await res.json()) as { data: PlanFeature }
    setFeatures((prev) => [...prev, data])
    setNewFeatureLabel((prev) => ({ ...prev, [categoryId]: '' }))
    toastSuccess('Linha criada.')
  }

  async function deleteFeature(id: string) {
    const res = await fetch(`/api/v1/admin/plan-features/features/${id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível remover a linha.')); return }
    setFeatures((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div>
      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '13.5px', color: '#8A7560', lineHeight: 1.6 }}
      >
        Cada célula é o texto exibido na comparação de planos (ex: &quot;✅&quot;, &quot;❌&quot;, &quot;Até 250&quot;).
        Cada campo salva sozinho ao sair dele (blur).
      </div>

      <div className="flex flex-col gap-5">
        {categories.map((category) => {
          const categoryFeatures = features.filter((f) => f.category_id === category.id)

          return (
            <div key={category.id} className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#2A1E10' }}>{category.title}</span>
                <button
                  type="button"
                  onClick={() => deleteCategory(category.id)}
                  style={{ border: 'none', background: 'transparent', color: '#B0503A', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Remover categoria
                </button>
              </div>

              <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#8A7560', textTransform: 'uppercase' }}>Recurso</span>
                {GROUPS.map((g) => (
                  <span key={g.key} style={{ fontSize: '11px', fontWeight: 700, color: '#8A7560', textTransform: 'uppercase' }}>{g.label}</span>
                ))}
                <span />
              </div>

              {categoryFeatures.map((feature) => (
                <div key={feature.id} className="mb-2 grid items-center gap-2" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto' }}>
                  <span style={{ fontSize: '13.5px', color: '#2A1E10' }}>{feature.label}</span>
                  {GROUPS.map((g) => {
                    const key = `${feature.id}:${g.key}`
                    return (
                      <input
                        key={g.key}
                        style={inputStyle}
                        value={cellValues[key] ?? ''}
                        onChange={(e) => setCellValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={(e) => saveCell(feature.id, g.key, e.target.value)}
                      />
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => deleteFeature(feature.id)}
                    aria-label={`Remover linha ${feature.label}`}
                    style={{ border: 'none', background: 'transparent', color: '#B0503A', fontSize: '13px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div className="mt-3 flex gap-2">
                <input
                  style={inputStyle}
                  placeholder="Nova linha (ex: Suporte)"
                  value={newFeatureLabel[category.id] ?? ''}
                  onChange={(e) => setNewFeatureLabel((prev) => ({ ...prev, [category.id]: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => addFeature(category.id)}
                  style={{
                    border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 600, fontSize: '12.5px',
                    background: '#2A1E10', color: '#FAF0E6', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  + Linha
                </button>
              </div>
            </div>
          )
        })}

        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A1E10', marginBottom: '10px' }}>Nova categoria</div>
          <div className="flex gap-2">
            <input style={inputStyle} placeholder="Ex: Segurança" value={newCategoryTitle} onChange={(e) => setNewCategoryTitle(e.target.value)} />
            <button
              type="button"
              onClick={addCategory}
              style={{
                border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: 600, fontSize: '12.5px',
                background: '#2A1E10', color: '#FAF0E6', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              + Categoria
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
