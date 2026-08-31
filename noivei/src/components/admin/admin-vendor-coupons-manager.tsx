'use client'

import Link from 'next/link'
import { useState } from 'react'
import Modal from '@/components/ui/modal'
import ToggleSwitch from '@/components/ui/toggle-switch'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorCoupon, VendorCouponDiscountType, VendorPlan } from '@/types/database'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface CouponForm {
  code:               string
  discount_type:      VendorCouponDiscountType
  discount_value:     string
  applies_to_plan_id: string
  benefit_days:       string
  max_redemptions:    string
}

const EMPTY_FORM: CouponForm = {
  code: '', discount_type: 'percent', discount_value: '', applies_to_plan_id: '', benefit_days: '', max_redemptions: '',
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

function fmtDiscount(coupon: VendorCoupon): string {
  if (coupon.discount_type === 'free_days') return `${coupon.benefit_days} dia(s) grátis`
  return coupon.discount_type === 'percent'
    ? `${coupon.discount_value}%`
    : currencyFmt.format((coupon.discount_value ?? 0) / 100)
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '10px 13px', fontSize: '14px', outline: 'none',
}
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }

interface AdminVendorCouponsManagerProps {
  initialCoupons: VendorCoupon[]
  plans:          Pick<VendorPlan, 'id' | 'name' | 'billing_type'>[]
}

export default function AdminVendorCouponsManager({ initialCoupons, plans }: AdminVendorCouponsManagerProps) {
  const [coupons, setCoupons]     = useState(initialCoupons)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState<CouponForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  function setField<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function toggleActive(coupon: VendorCoupon) {
    const res = await fetch(`/api/v1/admin/vendor-coupons/${coupon.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !coupon.is_active }),
    })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar o cupom.'))
      return
    }
    const body = (await res.json()) as { data: VendorCoupon }
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? body.data : c)))
  }

  async function removeCoupon(coupon: VendorCoupon) {
    if (!window.confirm(`Remover o cupom "${coupon.code}"?`)) return
    const res = await fetch(`/api/v1/admin/vendor-coupons/${coupon.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover o cupom.'))
      return
    }
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id))
    toastSuccess('Cupom removido.')
  }

  async function createCoupon() {
    if (!form.code.trim()) {
      toastError('Informe o código do cupom.')
      return
    }

    const payload: Record<string, unknown> = {
      code:            form.code.trim(),
      discount_type:   form.discount_type,
      max_redemptions: form.max_redemptions ? parseInt(form.max_redemptions, 10) : undefined,
    }

    if (form.discount_type === 'free_days') {
      if (!form.applies_to_plan_id || !form.benefit_days) {
        toastError('Cupom de dias grátis precisa de plano e quantidade de dias.')
        return
      }
      payload.applies_to_plan_id = form.applies_to_plan_id
      payload.benefit_days = parseInt(form.benefit_days, 10)
    } else {
      const value = parseFloat(form.discount_value.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) {
        toastError('Informe um valor de desconto válido.')
        return
      }
      payload.discount_value = form.discount_type === 'percent' ? Math.round(value) : Math.round(value * 100)
      if (form.applies_to_plan_id) payload.applies_to_plan_id = form.applies_to_plan_id
    }

    setSaving(true)
    const res = await fetch('/api/v1/admin/vendor-coupons', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    setSaving(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar o cupom.'))
      return
    }
    const body = (await res.json()) as { data: VendorCoupon }
    setCoupons((prev) => [body.data, ...prev])
    setModalOpen(false)
    setForm(EMPTY_FORM)
    toastSuccess('Cupom criado.')
  }

  return (
    <div>
      <Link href="/admin/fornecedores" style={{ fontSize: '13px', color: '#8A5A2E', textDecoration: 'none' }}>← Fornecedores</Link>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '10px 0 20px' }}>
        <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: '#3C2818', margin: 0 }}>Cupons de fornecedor</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{ border: 'none', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '13.5px', background: '#8A5A2E', color: '#fff', cursor: 'pointer' }}
        >
          + Novo cupom
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(60,40,24,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#F4EFE7', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Código</th>
              <th style={{ padding: '12px 16px' }}>Desconto</th>
              <th style={{ padding: '12px 16px' }}>Usos</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#8A7D6E' }}>Nenhum cupom criado ainda.</td></tr>
            )}
            {coupons.map((coupon) => (
              <tr key={coupon.id} style={{ borderTop: '1px solid #F0E6D8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#3C2818' }}>{coupon.code}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{fmtDiscount(coupon)}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>
                  {coupon.redemption_count}{coupon.max_redemptions ? `/${coupon.max_redemptions}` : ''}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <ToggleSwitch checked={coupon.is_active} onChange={() => toggleActive(coupon)} label={coupon.is_active ? 'Ativo' : 'Inativo'} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => removeCoupon(coupon)}
                    style={{ border: 'none', background: 'none', color: '#C0553F', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo cupom de fornecedor" maxWidth="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Código</label>
            <input style={inputStyle} value={form.code} onChange={(e) => setField('code', e.target.value.toUpperCase())} placeholder="Ex: FORNECEDOR10" />
          </div>

          <div>
            <label style={labelStyle}>Tipo de desconto</label>
            <select style={inputStyle} value={form.discount_type} onChange={(e) => setField('discount_type', e.target.value as VendorCouponDiscountType)}>
              <option value="percent">Percentual</option>
              <option value="fixed">Valor fixo</option>
              <option value="free_days">Dias grátis</option>
            </select>
          </div>

          {form.discount_type !== 'free_days' && (
            <div>
              <label style={labelStyle}>{form.discount_type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}</label>
              <input style={inputStyle} value={form.discount_value} onChange={(e) => setField('discount_value', e.target.value)} />
            </div>
          )}

          {form.discount_type === 'free_days' && (
            <div>
              <label style={labelStyle}>Dias grátis</label>
              <input style={inputStyle} value={form.benefit_days} onChange={(e) => setField('benefit_days', e.target.value)} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Plano {form.discount_type === 'free_days' ? '(obrigatório)' : '(opcional — vazio vale para qualquer plano)'}</label>
            <select style={inputStyle} value={form.applies_to_plan_id} onChange={(e) => setField('applies_to_plan_id', e.target.value)}>
              <option value="">— Qualquer plano —</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} ({plan.billing_type === 'monthly' ? 'Mensal' : 'Vitalício'})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Limite de usos (opcional)</label>
            <input style={inputStyle} value={form.max_redemptions} onChange={(e) => setField('max_redemptions', e.target.value)} />
          </div>

          <button
            type="button"
            onClick={createCoupon}
            disabled={saving}
            style={{ border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, fontSize: '14px', background: '#8A5A2E', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Criando…' : 'Criar cupom'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
