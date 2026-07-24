'use client'

import { useState } from 'react'

import CurrencyInput from '@/components/ui/currency-input'
import Spinner from '@/components/ui/spinner'
import ToggleSwitch from '@/components/ui/toggle-switch'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'

export interface AdminPlanLimit {
  id:      string
  feature: string
  value:   number
}

export interface AdminPlan {
  id:            string
  name:          string
  description:   string | null
  price_brl:     number
  is_active:     boolean
  group_key:     string | null
  billing_label: string | null
  billing_note:  string | null
  emoji:         string
  highlight:     boolean
  sort_order:    number
  limits:        AdminPlanLimit[]
}

interface AdminPlansManagerProps {
  initialPlans: AdminPlan[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface PlanDraft {
  name:          string
  description:   string
  price_brl:     number | null
  is_active:     boolean
  group_key:     string
  billing_label: string
  billing_note:  string
  emoji:         string
  highlight:     boolean
  sort_order:    number
}

interface NewPlanForm {
  id:            string
  name:          string
  description:   string
  price_brl:     number | null
  group_key:     string
  billing_label: string
  billing_note:  string
  emoji:         string
  highlight:     boolean
  is_active:     boolean
}

const EMPTY_NEW_PLAN: NewPlanForm = {
  id: '', name: '', description: '', price_brl: null, group_key: '',
  billing_label: '', billing_note: '', emoji: '💳', highlight: false, is_active: true,
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
  return {
    name: plan.name, description: plan.description ?? '', price_brl: plan.price_brl, is_active: plan.is_active,
    group_key: plan.group_key ?? '', billing_label: plan.billing_label ?? '', billing_note: plan.billing_note ?? '',
    emoji: plan.emoji, highlight: plan.highlight, sort_order: plan.sort_order,
  }
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
  const [newLimitDrafts, setNewLimitDrafts] = useState<Record<string, { feature: string; value: number | null }>>({})

  const [newPlan, setNewPlan] = useState<NewPlanForm>(EMPTY_NEW_PLAN)
  const [creating, setCreating] = useState(false)

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
        name:          draft.name.trim(),
        description:   draft.description.trim() || null,
        price_brl:     draft.price_brl,
        is_active:     draft.is_active,
        group_key:     draft.group_key.trim() || null,
        billing_label: draft.billing_label.trim() || null,
        billing_note:  draft.billing_note.trim() || null,
        emoji:         draft.emoji.trim() || '💳',
        highlight:     draft.highlight,
        sort_order:    draft.sort_order,
      }),
    })
    setSavingPlanId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o plano.'))
      return
    }

    const { data } = (await res.json()) as { data: Omit<AdminPlan, 'limits'> }
    setPlans((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)))
    setDrafts((prev) => ({ ...prev, [data.id]: draftFromPlan({ ...data, limits: [] }) }))
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

  async function handleDeleteLimit(limit: AdminPlanLimit, planId: string) {
    if (!window.confirm(`Remover o limite "${humanizeFeature(limit.feature)}" deste plano?`)) return

    const res = await fetch(`/api/v1/admin/plan-limits/${limit.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover o limite.'))
      return
    }

    setPlans((prev) =>
      prev.map((p) => (p.id !== planId ? p : { ...p, limits: p.limits.filter((l) => l.id !== limit.id) })),
    )
    toastSuccess('Limite removido.')
  }

  async function handleCreateLimit(planId: string) {
    const draft = newLimitDrafts[planId]
    if (!draft?.feature.trim() || draft.value === null) {
      toastError('Informe a feature e o valor do limite.')
      return
    }

    const res = await fetch('/api/v1/admin/plan-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, feature: draft.feature.trim(), value: draft.value }),
    })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar o limite.'))
      return
    }

    const { data } = (await res.json()) as { data: AdminPlanLimit }
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, limits: [...p.limits, data] } : p)))
    setLimitDrafts((prev) => ({ ...prev, [data.id]: data.value }))
    setNewLimitDrafts((prev) => ({ ...prev, [planId]: { feature: '', value: null } }))
    toastSuccess('Limite criado.')
  }

  async function handleDeletePlan(plan: AdminPlan) {
    if (!window.confirm(`Excluir o plano "${plan.name}" (${plan.id})? Só é possível se ninguém estiver assinando ele.`)) return

    const res = await fetch(`/api/v1/admin/plans/${plan.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível excluir o plano.'))
      return
    }

    setPlans((prev) => prev.filter((p) => p.id !== plan.id))
    setDrafts((prev) => {
      const rest = { ...prev }
      delete rest[plan.id]
      return rest
    })
    toastSuccess('Plano removido.')
  }

  async function handleCreatePlan() {
    if (creating) return
    if (!newPlan.id.trim() || !newPlan.name.trim() || newPlan.price_brl === null) {
      toastError('Preencha id, nome e preço.')
      return
    }

    setCreating(true)
    const res = await fetch('/api/v1/admin/plans', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        id:            newPlan.id.trim(),
        name:          newPlan.name.trim(),
        description:   newPlan.description.trim() || null,
        price_brl:     newPlan.price_brl,
        group_key:     newPlan.group_key.trim() || null,
        billing_label: newPlan.billing_label.trim() || null,
        billing_note:  newPlan.billing_note.trim() || null,
        emoji:         newPlan.emoji.trim() || '💳',
        highlight:     newPlan.highlight,
        is_active:     newPlan.is_active,
      }),
    })
    setCreating(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar o plano.'))
      return
    }

    const { data } = (await res.json()) as { data: AdminPlan }
    setPlans((prev) => [...prev, data])
    setDrafts((prev) => ({ ...prev, [data.id]: draftFromPlan(data) }))
    setNewPlan(EMPTY_NEW_PLAN)
    toastSuccess('Plano criado! Não esqueça de adicionar os limites dele.')
  }

  return (
    <div>
      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '13.5px', color: '#8A7560', lineHeight: 1.6 }}
      >
        Editar preços aqui não altera retroativamente o valor cobrado de quem já assina um plano — ainda não há
        gateway de pagamento real integrado. As mudanças só passam a valer para novas seleções e exibições de
        plano a partir de agora. <strong>Grupo (group_key)</strong>: planos com o mesmo grupo viram variantes de
        cobrança (toggle) do mesmo card em /perfil/planos — deixe em branco para um card próprio.
      </div>

      <div className="flex flex-col gap-5 mb-8">
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
                <div className="flex items-center gap-4">
                  <ToggleSwitch
                    checked={draft.is_active}
                    onChange={(checked) => updateDraft(plan.id, { is_active: checked })}
                    label="Ativo"
                  />
                  <ToggleSwitch
                    checked={draft.highlight}
                    onChange={(checked) => updateDraft(plan.id, { highlight: checked })}
                    label="Destaque"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(plan)}
                    style={{ border: 'none', background: 'transparent', color: '#B0503A', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Excluir plano
                  </button>
                </div>
              </div>

              <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
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
                <div>
                  <label style={labelStyle} htmlFor={`emoji-${plan.id}`}>Emoji</label>
                  <input
                    id={`emoji-${plan.id}`}
                    type="text"
                    maxLength={8}
                    value={draft.emoji}
                    onChange={(e) => updateDraft(plan.id, { emoji: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
                <div>
                  <label style={labelStyle} htmlFor={`group-${plan.id}`}>Grupo (card)</label>
                  <input
                    id={`group-${plan.id}`}
                    type="text"
                    placeholder="em branco = card próprio"
                    value={draft.group_key}
                    onChange={(e) => updateDraft(plan.id, { group_key: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={`billing-label-${plan.id}`}>Rótulo da variante</label>
                  <input
                    id={`billing-label-${plan.id}`}
                    type="text"
                    placeholder="Ex: Mensal"
                    maxLength={40}
                    value={draft.billing_label}
                    onChange={(e) => updateDraft(plan.id, { billing_label: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={`billing-note-${plan.id}`}>Texto sob o preço</label>
                  <input
                    id={`billing-note-${plan.id}`}
                    type="text"
                    placeholder="Ex: /mês"
                    maxLength={120}
                    value={draft.billing_note}
                    onChange={(e) => updateDraft(plan.id, { billing_note: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={`sort-${plan.id}`}>Ordem</label>
                  <input
                    id={`sort-${plan.id}`}
                    type="number"
                    min={0}
                    value={draft.sort_order}
                    onChange={(e) => updateDraft(plan.id, { sort_order: Number(e.target.value) || 0 })}
                    style={inputStyle}
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

              <div className="mt-5 pt-4" style={{ borderTop: '1px solid #F0E8DE' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A7560', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Limites
                </div>
                {plan.limits.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
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
                          <button
                            type="button"
                            onClick={() => handleDeleteLimit(limit, plan.id)}
                            aria-label={`Remover limite ${humanizeFeature(limit.feature)}`}
                            style={{ border: 'none', background: 'transparent', color: '#B0503A', fontSize: '13px', cursor: 'pointer', padding: '4px' }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="feature (ex: max_guests)"
                    value={newLimitDrafts[plan.id]?.feature ?? ''}
                    onChange={(e) =>
                      setNewLimitDrafts((prev) => ({ ...prev, [plan.id]: { feature: e.target.value, value: prev[plan.id]?.value ?? null } }))
                    }
                    style={{ ...inputStyle, flex: 1, minWidth: '140px' }}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="valor"
                    value={newLimitDrafts[plan.id]?.value ?? ''}
                    onChange={(e) =>
                      setNewLimitDrafts((prev) => ({
                        ...prev,
                        [plan.id]: { feature: prev[plan.id]?.feature ?? '', value: e.target.value === '' ? null : Number(e.target.value) },
                      }))
                    }
                    style={{ ...inputStyle, width: '110px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateLimit(plan.id)}
                    style={{
                      border: 'none', borderRadius: '10px', padding: '9px 14px', fontWeight: 600, fontSize: '12.5px',
                      background: '#2A1E10', color: '#FAF0E6', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    + Limite
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#2A1E10', marginBottom: '14px' }}>Criar plano</div>

        <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
          <div>
            <label style={labelStyle} htmlFor="new-plan-id">Id</label>
            <input
              id="new-plan-id"
              type="text"
              placeholder="ex: premium_anual"
              value={newPlan.id}
              onChange={(e) => setNewPlan((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="new-plan-name">Nome</label>
            <input
              id="new-plan-name"
              type="text"
              maxLength={80}
              value={newPlan.name}
              onChange={(e) => setNewPlan((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="new-plan-price">Preço</label>
            <CurrencyInput id="new-plan-price" value={newPlan.price_brl} onChange={(cents) => setNewPlan((f) => ({ ...f, price_brl: cents }))} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="new-plan-emoji">Emoji</label>
            <input
              id="new-plan-emoji"
              type="text"
              maxLength={8}
              value={newPlan.emoji}
              onChange={(e) => setNewPlan((f) => ({ ...f, emoji: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
          <div>
            <label style={labelStyle} htmlFor="new-plan-group">Grupo (card)</label>
            <input
              id="new-plan-group"
              type="text"
              placeholder="em branco = card próprio; igual a outro plano = vira variante"
              value={newPlan.group_key}
              onChange={(e) => setNewPlan((f) => ({ ...f, group_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="new-plan-billing-label">Rótulo da variante</label>
            <input
              id="new-plan-billing-label"
              type="text"
              placeholder="Ex: Mensal (só se tiver grupo)"
              maxLength={40}
              value={newPlan.billing_label}
              onChange={(e) => setNewPlan((f) => ({ ...f, billing_label: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="new-plan-billing-note">Texto sob o preço</label>
            <input
              id="new-plan-billing-note"
              type="text"
              placeholder="Ex: /mês"
              maxLength={120}
              value={newPlan.billing_note}
              onChange={(e) => setNewPlan((f) => ({ ...f, billing_note: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="mb-4">
          <label style={labelStyle} htmlFor="new-plan-description">Descrição</label>
          <textarea
            id="new-plan-description"
            value={newPlan.description}
            maxLength={500}
            rows={2}
            onChange={(e) => setNewPlan((f) => ({ ...f, description: e.target.value }))}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div className="mb-4 flex items-center gap-6">
          <ToggleSwitch checked={newPlan.highlight} onChange={(checked) => setNewPlan((f) => ({ ...f, highlight: checked }))} label="Destaque" />
          <ToggleSwitch checked={newPlan.is_active} onChange={(checked) => setNewPlan((f) => ({ ...f, is_active: checked }))} label="Ativo" />
        </div>

        <button
          type="button"
          onClick={handleCreatePlan}
          disabled={creating}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: '#2A1E10', color: '#FAF0E6', border: 'none',
            borderRadius: '12px', padding: '10px 18px', fontWeight: 600, fontSize: '13.5px',
            cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? 'Criando…' : 'Criar plano'}
        </button>
      </div>
    </div>
  )
}
