'use client'

import { useState } from 'react'

import CurrencyInput from '@/components/ui/currency-input'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { PLAN_IDS, PLAN_NAMES, type PlanId } from '@/constants/plans'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { Coupon, CouponDiscountType } from '@/types/database'

interface AdminCouponsManagerProps {
  initialCoupons: Coupon[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface CouponForm {
  code:               string
  discount_type:      CouponDiscountType
  discount_value:     number | null
  applies_to_plan_id: string
  // Só usado quando discount_type = 'free_days'.
  benefit_days:       number | null
  max_redemptions:    number | null
  valid_from:         string
  valid_until:        string
  is_active:          boolean
}

const EMPTY_FORM: CouponForm = {
  code: '', discount_type: 'percent', discount_value: null, applies_to_plan_id: '',
  benefit_days: null, max_redemptions: null, valid_from: '', valid_until: '', is_active: true,
}

const PLAN_OPTIONS: { value: PlanId; label: string }[] = [
  { value: PLAN_IDS.PREMIUM_MONTHLY, label: `${PLAN_NAMES[PLAN_IDS.PREMIUM_MONTHLY]} (mensal)` },
  { value: PLAN_IDS.PREMIUM_ONCE,    label: `${PLAN_NAMES[PLAN_IDS.PREMIUM_ONCE]} (parcela única)` },
  { value: PLAN_IDS.PLUS_MONTHLY,    label: `${PLAN_NAMES[PLAN_IDS.PLUS_MONTHLY]} (mensal)` },
  { value: PLAN_IDS.PLUS_ONCE,       label: `${PLAN_NAMES[PLAN_IDS.PLUS_ONCE]} (parcela única)` },
]

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDiscount(coupon: Coupon): string {
  if (coupon.discount_type === 'free_days') return `${coupon.benefit_days} dia(s) grátis`
  return coupon.discount_type === 'percent'
    ? `${coupon.discount_value}%`
    : currencyFmt.format((coupon.discount_value ?? 0) / 100)
}

function fmtPlan(planId: string | null): string {
  if (!planId) return 'Qualquer plano pago'
  return PLAN_NAMES[planId as PlanId] ?? planId
}

// Datas são salvas como meia-noite UTC (ver dateInputToIso) — formatar de volta com
// timeZone: 'UTC' evita que o fuso do navegador jogue o dia exibido para o anterior.
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function fmtValidity(coupon: Coupon): string {
  const from = coupon.valid_from ? fmtDate(coupon.valid_from) : null
  const until = coupon.valid_until ? fmtDate(coupon.valid_until) : null
  if (!from && !until) return 'Sem restrição de data'
  if (from && until) return `${from} – ${until}`
  return from ? `A partir de ${from}` : `Até ${until}`
}

function dateInputToIso(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
}

function isoToDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : ''
}

function draftFromCoupon(coupon: Coupon): CouponForm {
  return {
    code:               coupon.code,
    discount_type:      coupon.discount_type,
    discount_value:     coupon.discount_value,
    applies_to_plan_id: coupon.applies_to_plan_id ?? '',
    benefit_days:       coupon.benefit_days,
    max_redemptions:    coupon.max_redemptions,
    valid_from:         isoToDateInput(coupon.valid_from),
    valid_until:        isoToDateInput(coupon.valid_until),
    is_active:          coupon.is_active,
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 13px',
  fontSize: '14.5px', color: '#2A1E10', background: '#FFFFFF', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12.5px', fontWeight: 600, color: '#2A1E10', marginBottom: '6px', display: 'block',
}

export default function AdminCouponsManager({ initialCoupons }: AdminCouponsManagerProps) {
  const [coupons, setCoupons]     = useState<Coupon[]>(initialCoupons)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Coupon | null>(null)
  const [form, setForm]           = useState<CouponForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const showSaveSpinner           = useDelayedLoading(saving)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon)
    setForm(draftFromCoupon(coupon))
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    if (!form.code.trim()) {
      toastError('Informe um código para o cupom.')
      return
    }

    if (form.discount_type === 'free_days') {
      if (!form.applies_to_plan_id) {
        toastError('Escolha o plano que o cupom concede.')
        return
      }
      if (!form.benefit_days || form.benefit_days < 1) {
        toastError('Informe quantos dias o cupom concede.')
        return
      }
    } else {
      if (!form.discount_value || form.discount_value < 1) {
        toastError('Informe um valor de desconto válido.')
        return
      }
      if (form.discount_type === 'percent' && form.discount_value > 100) {
        toastError('Desconto percentual não pode passar de 100.')
        return
      }
    }

    setSaving(true)

    const payload =
      form.discount_type === 'free_days'
        ? {
            code:               form.code.trim(),
            discount_type:      form.discount_type,
            applies_to_plan_id: form.applies_to_plan_id,
            benefit_days:       form.benefit_days,
            max_redemptions:    form.max_redemptions,
            valid_from:         dateInputToIso(form.valid_from),
            valid_until:        dateInputToIso(form.valid_until),
            is_active:          form.is_active,
          }
        : {
            code:               form.code.trim(),
            discount_type:      form.discount_type,
            discount_value:     form.discount_value,
            applies_to_plan_id: form.applies_to_plan_id || null,
            max_redemptions:    form.max_redemptions,
            valid_from:         dateInputToIso(form.valid_from),
            valid_until:        dateInputToIso(form.valid_until),
            is_active:          form.is_active,
          }

    const res = editing
      ? await fetch(`/api/v1/admin/coupons/${editing.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
      : await fetch('/api/v1/admin/coupons', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })

    setSaving(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o cupom.'))
      return
    }

    const { data } = (await res.json()) as { data: Coupon }
    setCoupons((prev) => (editing ? prev.map((c) => (c.id === data.id ? data : c)) : [data, ...prev]))
    setModalOpen(false)
    toastSuccess(editing ? 'Cupom atualizado!' : 'Cupom criado!')
  }

  async function handleDelete(coupon: Coupon) {
    if (!window.confirm(`Excluir o cupom "${coupon.code}"?`)) return

    const previous = coupons
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id))

    const res = await fetch(`/api/v1/admin/coupons/${coupon.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setCoupons(previous)
      toastError(await readApiError(res, 'Não foi possível excluir o cupom.'))
      return
    }
    toastSuccess('Cupom removido.')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '0 0 6px' }}
          >
            Cupons
          </h1>
          <p style={{ fontSize: '14.5px', color: '#8A7560', margin: 0 }}>
            Gerencie os cupons de desconto disponíveis para os planos pagos.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#2A1E10', color: '#FAF0E6', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}
        >
          <PlusIcon /> Novo cupom
        </button>
      </div>

      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '13.5px', color: '#8A7560', lineHeight: 1.6 }}
      >
Cupons de <strong>dias grátis</strong> já podem ser resgatados pelo casal em /perfil/planos (concedem o plano
        na hora, sem cobrança). Cupons de <strong>desconto percentual/fixo</strong> ficam só cadastrados —
        aplicá-los de fato depende de um gateway de pagamento real (ver TODO Fase 2 em{' '}
        <code>plan-selector.tsx</code>), que ainda não existe.
      </div>

      <div className="overflow-hidden rounded-2xl" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
        {coupons.map((coupon, idx) => (
          <div
            key={coupon.id}
            className="flex flex-wrap items-center gap-4 px-5 py-4"
            style={{ borderBottom: idx < coupons.length - 1 ? '1px solid #F0E8DE' : 'none' }}
          >
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#2A1E10', letterSpacing: '0.02em' }}>
                {coupon.code}
              </div>
              <div style={{ fontSize: '12.5px', color: '#8A7560', marginTop: '1px' }}>
                {fmtDiscount(coupon)} · {fmtPlan(coupon.applies_to_plan_id)}
              </div>
              <div style={{ fontSize: '12px', color: '#8A7560', marginTop: '1px' }}>
                {fmtValidity(coupon)}
              </div>
            </div>

            <span
              style={{
                fontSize: '12px', fontWeight: 600, padding: '5px 12px',
                borderRadius: '99px', flexShrink: 0, background: '#F4EFE7', color: '#8A7560',
              }}
            >
              {coupon.redemption_count} / {coupon.max_redemptions ?? '∞'}
            </span>

            <span
              style={{
                fontSize: '12px', fontWeight: 600, padding: '5px 12px',
                borderRadius: '99px', flexShrink: 0,
                background: coupon.is_active ? '#E9EFE6' : '#F4E6E1',
                color: coupon.is_active ? '#5E8B6A' : '#B0503A',
              }}
            >
              {coupon.is_active ? 'Ativo' : 'Inativo'}
            </span>

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={() => openEdit(coupon)}
                title="Editar cupom"
                aria-label={`Editar cupom ${coupon.code}`}
                style={{ border: 'none', background: 'transparent', color: '#8A7560', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
              >
                <PencilIcon />
              </button>
              <button
                onClick={() => handleDelete(coupon)}
                title="Excluir cupom"
                aria-label={`Excluir cupom ${coupon.code}`}
                style={{ border: 'none', background: 'transparent', color: '#8A7560', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
        {coupons.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8A7560', fontSize: '14px' }}>
            Nenhum cupom cadastrado ainda. Crie o primeiro.
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cupom' : 'Novo cupom'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="coupon-code" style={labelStyle}>Código *</label>
            <input
              id="coupon-code"
              type="text"
              required
              maxLength={40}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="NOIVOS2026"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
            <p style={{ fontSize: '12px', color: '#8A7560', marginTop: '4px' }}>
              Salvo em maiúsculas automaticamente, sem espaços ou acentos.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Tipo de desconto</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#2A1E10', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="coupon-discount-type"
                  checked={form.discount_type === 'percent'}
                  onChange={() => setForm((f) => ({ ...f, discount_type: 'percent' }))}
                />
                Percentual
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#2A1E10', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="coupon-discount-type"
                  checked={form.discount_type === 'fixed'}
                  onChange={() => setForm((f) => ({ ...f, discount_type: 'fixed' }))}
                />
                Valor fixo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#2A1E10', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="coupon-discount-type"
                  checked={form.discount_type === 'free_days'}
                  onChange={() => setForm((f) => ({ ...f, discount_type: 'free_days' }))}
                />
                Dias grátis de um plano
              </label>
            </div>
          </div>

          {form.discount_type === 'free_days' ? (
            <>
              <div
                className="rounded-2xl p-3"
                style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '12.5px', color: '#8A7560', lineHeight: 1.5 }}
              >
                Funciona de verdade, sem depender de gateway de pagamento: ao resgatar, o usuário ganha acesso
                ao plano escolhido pelos dias informados.
              </div>
              <div>
                <label htmlFor="coupon-plan" style={labelStyle}>Plano concedido *</label>
                <select
                  id="coupon-plan"
                  required
                  value={form.applies_to_plan_id}
                  onChange={(e) => setForm((f) => ({ ...f, applies_to_plan_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Selecione um plano</option>
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="coupon-benefit-days" style={labelStyle}>Dias de acesso *</label>
                <input
                  id="coupon-benefit-days"
                  type="number"
                  required
                  min={1}
                  value={form.benefit_days ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, benefit_days: e.target.value === '' ? null : Number(e.target.value) }))}
                  style={inputStyle}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="coupon-discount-value" style={labelStyle}>
                  {form.discount_type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'} *
                </label>
                {form.discount_type === 'percent' ? (
                  <input
                    id="coupon-discount-value"
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={form.discount_value ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value === '' ? null : Number(e.target.value) }))}
                    style={inputStyle}
                  />
                ) : (
                  <CurrencyInput
                    id="coupon-discount-value"
                    value={form.discount_value}
                    onChange={(cents) => setForm((f) => ({ ...f, discount_value: cents }))}
                  />
                )}
              </div>

              <div>
                <label htmlFor="coupon-plan" style={labelStyle}>Aplica-se a</label>
                <select
                  id="coupon-plan"
                  value={form.applies_to_plan_id}
                  onChange={(e) => setForm((f) => ({ ...f, applies_to_plan_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Qualquer plano pago</option>
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label htmlFor="coupon-max-redemptions" style={labelStyle}>Limite de usos</label>
            <input
              id="coupon-max-redemptions"
              type="number"
              min={1}
              value={form.max_redemptions ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value === '' ? null : Number(e.target.value) }))}
              placeholder="Deixe em branco para ilimitado"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="coupon-valid-from" style={labelStyle}>Válido a partir de</label>
              <input
                id="coupon-valid-from"
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="coupon-valid-until" style={labelStyle}>Válido até</label>
              <input
                id="coupon-valid-until"
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#2A1E10', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Ativo
          </label>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{
                background: 'transparent', color: '#8A7560', border: 'none',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: '10px 14px',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#2A1E10', color: '#FAF0E6', border: 'none',
                borderRadius: '12px', padding: '10px 18px',
                fontWeight: 600, fontSize: '14px',
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {showSaveSpinner && <Spinner color="#FAF0E6" />} {editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
