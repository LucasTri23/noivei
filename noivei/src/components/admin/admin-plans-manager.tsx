'use client'

import { useState } from 'react'

import CurrencyInput from '@/components/ui/currency-input'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'

export interface AdminPlanLimit {
  id:      string
  feature: string
  value:   number
}

export interface AdminPlan {
  id:          string
  name:        string
  description: string | null
  price_brl:   number
  is_active:   boolean
  limits:      AdminPlanLimit[]
}

interface AdminPlansManagerProps {
  initialPlans: AdminPlan[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface PlanDraft {
  name:        string
  description: string
  price_brl:   number | null
  is_active:   boolean
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function draftFromPlan(plan: AdminPlan): PlanDraft {
  return { name: plan.name, description: plan.description ?? '', price_brl: plan.price_brl, is_active: plan.is_active }
}

// Só a parte "max_" é o prefixo comum a todas as features conhecidas (ver check-limit.ts) —
// removê-lo deixa o rótulo mais legível sem precisar de um dicionário feature -> label.
function humanizeFeature(feature: string): string {
  return feature.replace(/^max_/, '').replace(/_/g, ' ')
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 13px',
  fontSize: '14.5px', color: '#2A1E10', background: '#FFFFFF', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12.5px', fontWeight: 600, color: '#2A1E10', marginBottom: '6px', display: 'block',
}

export default function AdminPlansManager({ initialPlans }: AdminPlansManagerProps) {
  const [plans, setPlans]   = useState<AdminPlan[]>(initialPlans)
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>(() =>
    Object.fromEntries(initialPlans.map((plan) => [plan.id, draftFromPlan(plan)])),
  )
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const showPlanSpinner = useDelayedLoading(savingPlanId !== null)

  const [limitDrafts, setLimitDrafts] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(initialPlans.flatMap((plan) => plan.limits.map((limit) => [limit.id, limit.value] as const))),
  )
  const [savingLimitId, setSavingLimitId] = useState<string | null>(null)

  function updateDraft(planId: string, patch: Partial<PlanDraft>) {
    setDrafts((prev) => {
      const current = prev[planId]
      return current ? { ...prev, [planId]: { ...current, ...patch } } : prev
    })
  }

  async function handleSavePlan(plan: AdminPlan) {
    if (savingPlanId) return
    const draft = drafts[plan.id]
    if (!draft) return

    if (draft.price_brl === null) {
      toastError('Informe um preço válido.')
      return
    }
    if (!draft.name.trim()) {
      toastError('Informe um nome válido.')
      return
    }

    setSavingPlanId(plan.id)
    const res = await fetch(`/api/v1/admin/plans/${plan.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:        draft.name.trim(),
        description: draft.description.trim() || null,
        price_brl:   draft.price_brl,
        is_active:   draft.is_active,
      }),
    })
    setSavingPlanId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o plano.'))
      return
    }

    const { data } = (await res.json()) as {
      data: { id: string; name: string; description: string | null; price_brl: number; is_active: boolean }
    }
    setPlans((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)))
    setDrafts((prev) => ({
      ...prev,
      [data.id]: { name: data.name, description: data.description ?? '', price_brl: data.price_brl, is_active: data.is_active },
    }))
    toastSuccess('Plano atualizado!')
  }

  async function handleSaveLimit(limit: AdminPlanLimit) {
    if (savingLimitId) return
    const value = limitDrafts[limit.id]
    if (value === null || value === undefined) {
      toastError('Informe um valor válido.')
      return
    }

    setSavingLimitId(limit.id)
    const res = await fetch(`/api/v1/admin/plan-limits/${limit.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ value }),
    })
    setSavingLimitId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o limite.'))
      return
    }

    const { data } = (await res.json()) as { data: { id: string; plan_id: string; feature: string; value: number } }
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== data.plan_id ? p : { ...p, limits: p.limits.map((l) => (l.id === data.id ? { ...l, value: data.value } : l)) },
      ),
    )
    setLimitDrafts((prev) => ({ ...prev, [data.id]: data.value }))
    toastSuccess('Limite atualizado!')
  }

  return (
    <div>
      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '13.5px', color: '#8A7560', lineHeight: 1.6 }}
      >
        Editar preços aqui não altera retroativamente o valor cobrado de quem já assina um plano — ainda não há
        gateway de pagamento real integrado. As mudanças só passam a valer para novas seleções e exibições de
        plano a partir de agora.
      </div>

      <div className="flex flex-col gap-5">
        {plans.map((plan) => {
          const draft = drafts[plan.id]
          if (!draft) return null
          const saving = savingPlanId === plan.id

          return (
            <div key={plan.id} className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#8A7560', textTransform: 'uppercase' }}>
                  {plan.id}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#2A1E10', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => updateDraft(plan.id, { is_active: e.target.checked })}
                  />
                  Ativo
                </label>
              </div>

              <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
                <div>
                  <label style={labelStyle} htmlFor={`name-${plan.id}`}>Nome</label>
                  <input
                    id={`name-${plan.id}`}
                    type="text"
                    maxLength={80}
                    value={draft.name}
                    onChange={(e) => updateDraft(plan.id, { name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={`price-${plan.id}`}>Preço</label>
                  <CurrencyInput
                    id={`price-${plan.id}`}
                    value={draft.price_brl}
                    onChange={(cents) => updateDraft(plan.id, { price_brl: cents })}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label style={labelStyle} htmlFor={`description-${plan.id}`}>Descrição</label>
                <textarea
                  id={`description-${plan.id}`}
                  value={draft.description}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => updateDraft(plan.id, { description: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleSavePlan(plan)}
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#2A1E10', color: '#FAF0E6', border: 'none',
                  borderRadius: '12px', padding: '10px 18px', fontWeight: 600, fontSize: '13.5px',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving && showPlanSpinner && <Spinner color="#FAF0E6" />}
                Salvar
              </button>

              {plan.limits.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid #F0E8DE' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A7560', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Limites
                  </div>
                  <div className="flex flex-col gap-2">
                    {plan.limits.map((limit) => {
                      const savingLimit = savingLimitId === limit.id
                      const limitValue = limitDrafts[limit.id]
                      return (
                        <div key={limit.id} className="flex flex-wrap items-center gap-3">
                          <span style={{ fontSize: '13px', color: '#2A1E10', flex: 1, minWidth: '140px' }}>
                            {humanizeFeature(limit.feature)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={limitValue ?? ''}
                            onChange={(e) =>
                              setLimitDrafts((prev) => ({ ...prev, [limit.id]: e.target.value === '' ? null : Number(e.target.value) }))
                            }
                            style={{ ...inputStyle, width: '110px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveLimit(limit)}
                            disabled={savingLimit}
                            style={{
                              background: 'transparent', border: '1.5px solid #2A1E10', color: '#2A1E10',
                              borderRadius: '10px', padding: '7px 14px', fontWeight: 600, fontSize: '12.5px',
                              cursor: savingLimit ? 'wait' : 'pointer', opacity: savingLimit ? 0.7 : 1,
                            }}
                          >
                            Salvar
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
