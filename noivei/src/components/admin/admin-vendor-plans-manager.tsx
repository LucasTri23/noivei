'use client'

import Link from 'next/link'
import { useState } from 'react'
import ToggleSwitch from '@/components/ui/toggle-switch'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorPlan } from '@/types/database'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '16px', padding: '20px 22px', marginBottom: '14px',
  boxShadow: '0 4px 16px rgba(60,40,24,0.06)',
}
const inputStyle: React.CSSProperties = {
  border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', color: '#2A1E10', outline: 'none',
}

// Preço em reais (não centavos) no formulário, convertido pra centavos ao salvar —
// mesmo desenho de UI que CurrencyInput usa em outras telas de admin, sem
// depender do componente compartilhado (aqui só 2 linhas, formulário inline basta).
export default function AdminVendorPlansManager({ initialPlans }: { initialPlans: VendorPlan[] }) {
  const [plans, setPlans]     = useState(initialPlans)
  const [saving, setSaving]   = useState<string | null>(null)
  const [drafts, setDrafts]   = useState<Record<string, { name: string; priceBrl: string; sortOrder: string }>>(
    Object.fromEntries(initialPlans.map((p) => [p.id, { name: p.name, priceBrl: (p.price_cents / 100).toFixed(2), sortOrder: String(p.sort_order) }])),
  )

  function setDraftField(planId: string, field: 'name' | 'priceBrl' | 'sortOrder', value: string) {
    setDrafts((prev) => ({ ...prev, [planId]: { ...prev[planId]!, [field]: value } }))
  }

  async function save(plan: VendorPlan) {
    const draft = drafts[plan.id]!
    const priceCents = Math.round(parseFloat(draft.priceBrl.replace(',', '.')) * 100)
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toastError('Informe um preço válido.')
      return
    }

    setSaving(plan.id)
    const res = await fetch(`/api/v1/admin/vendor-plans/${plan.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        draft.name.trim(),
        price_cents: priceCents,
        sort_order:  parseInt(draft.sortOrder, 10) || 0,
        active:      plan.active,
      }),
    })
    setSaving(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o plano.'))
      return
    }
    const body = (await res.json()) as { data: VendorPlan }
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? body.data : p)))
    toastSuccess('Plano atualizado.')
  }

  async function toggleActive(plan: VendorPlan) {
    setSaving(plan.id)
    const res = await fetch(`/api/v1/admin/vendor-plans/${plan.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !plan.active }),
    })
    setSaving(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar o plano.'))
      return
    }
    const body = (await res.json()) as { data: VendorPlan }
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? body.data : p)))
  }

  return (
    <div>
      <Link href="/admin/fornecedores" style={{ fontSize: '13px', color: '#8A5A2E', textDecoration: 'none' }}>← Fornecedores</Link>
      <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: '#3C2818', margin: '10px 0 20px' }}>Planos de fornecedor</h1>

      <p style={{ fontSize: '13px', color: '#8A7D6E', marginBottom: '18px' }}>
        Alterar o preço aqui não muda cobranças já realizadas — vale só para novos checkouts a partir de agora.
      </p>

      {plans.map((plan) => {
        const draft = drafts[plan.id]!
        return (
          <div key={plan.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#8A7D6E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {plan.id} · {plan.billing_type === 'monthly' ? 'Mensal' : 'Vitalício'}
              </span>
              <ToggleSwitch checked={plan.active} onChange={() => toggleActive(plan)} label={plan.active ? 'Ativo' : 'Inativo'} />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '4px' }}>Nome</label>
                <input style={inputStyle} value={draft.name} onChange={(e) => setDraftField(plan.id, 'name', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '4px' }}>Preço (R$)</label>
                <input style={inputStyle} value={draft.priceBrl} onChange={(e) => setDraftField(plan.id, 'priceBrl', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '4px' }}>Ordem</label>
                <input style={{ ...inputStyle, width: '70px' }} value={draft.sortOrder} onChange={(e) => setDraftField(plan.id, 'sortOrder', e.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => save(plan)}
                disabled={saving === plan.id}
                style={{
                  border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 700, fontSize: '13.5px',
                  background: '#8A5A2E', color: '#fff', cursor: saving === plan.id ? 'not-allowed' : 'pointer',
                }}
              >
                {saving === plan.id ? 'Salvando…' : 'Salvar'}
              </button>
              <span style={{ fontSize: '13px', color: '#8A7D6E' }}>Atual: {currencyFmt.format(plan.price_cents / 100)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
