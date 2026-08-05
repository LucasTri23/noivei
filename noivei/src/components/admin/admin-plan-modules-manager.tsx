'use client'

import { useState } from 'react'
import { toastError } from '@/store/toast.store'
import { WEDDING_MODULE_LABELS } from '@/constants/wedding-modules'
import type { WeddingModuleKey } from '@/types/database'

interface PlanInfo {
  id:   string
  name: string
}

interface AccessRow {
  plan_id: string
  module:  WeddingModuleKey
  enabled: boolean
}

interface AdminPlanModulesManagerProps {
  plans:         PlanInfo[]
  initialAccess: AccessRow[]
}

interface ApiErrorBody {
  error?: { message?: string }
}

// Mesma lista fixa do CHECK em plan_module_access (migration 20260729000001,
// estendida em 20260801000001 para incluir 'checkin', em 20260803000001 para incluir
// 'album' e em 20260805000006 para incluir 'wedding_score').
const MODULES: WeddingModuleKey[] = [
  'checklist', 'convidados', 'financeiro', 'mesas',
  'site', 'arquivos', 'presentes', 'padrinhos', 'checkin', 'album', 'wedding_score',
]

export default function AdminPlanModulesManager({ plans, initialAccess }: AdminPlanModulesManagerProps) {
  // Linha ausente = liberado (mesmo fail-open do PaywallGate) — então o estado
  // inicial só grava as exceções conhecidas; qualquer combinação faltando assume `true`.
  const [access, setAccess] = useState<Record<string, boolean>>(
    Object.fromEntries(initialAccess.map((row) => [`${row.plan_id}:${row.module}`, row.enabled])),
  )
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(planId: string, module: WeddingModuleKey) {
    const key     = `${planId}:${module}`
    const current = access[key] ?? true
    const next    = !current

    setAccess((prev) => ({ ...prev, [key]: next }))
    setSaving(key)

    const res = await fetch('/api/v1/admin/plan-modules', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan_id: planId, module, enabled: next }),
    })

    setSaving(null)
    if (!res.ok) {
      setAccess((prev) => ({ ...prev, [key]: current }))
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null
      toastError(body?.error?.message ?? 'Não foi possível salvar essa permissão.')
    }
  }

  return (
    <div>
      <div
        className="mb-6 rounded-2xl p-4"
        style={{ background: '#F4EFE7', border: '1px solid #E5D8C4', fontSize: '13.5px', color: '#8A7560', lineHeight: 1.6 }}
      >
        Marque quais módulos cada plano libera. Isso controla o acesso de verdade (não é só a
        vitrine de comparação em /perfil/planos) — quem estiver num plano sem o módulo marcado
        vê a tela de upgrade ao tentar acessá-lo. Salva sozinho a cada clique.
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${280 + plans.length * 130}px` }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: 700,
                  color: '#8A7560', textTransform: 'uppercase', borderBottom: '1.5px solid #F0E6D8',
                }}
              >
                Módulo
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  style={{
                    textAlign: 'center', padding: '14px 12px', fontSize: '12.5px', fontWeight: 700,
                    color: '#2A1E10', borderBottom: '1.5px solid #F0E6D8', whiteSpace: 'nowrap',
                  }}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module, idx) => (
              <tr key={module} style={{ borderBottom: idx < MODULES.length - 1 ? '1px solid #F8F3EE' : 'none' }}>
                <td style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 600, color: '#2A1E10' }}>
                  {WEDDING_MODULE_LABELS[module]}
                </td>
                {plans.map((plan) => {
                  const key     = `${plan.id}:${module}`
                  const enabled = access[key] ?? true
                  const isSaving = saving === key
                  return (
                    <td key={plan.id} style={{ textAlign: 'center', padding: '12px' }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isSaving}
                        onChange={() => toggle(plan.id, module)}
                        aria-label={`${WEDDING_MODULE_LABELS[module]} no plano ${plan.name}`}
                        style={{ width: '18px', height: '18px', accentColor: '#2A1E10', cursor: isSaving ? 'wait' : 'pointer' }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
