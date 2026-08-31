'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorAdminAction, VendorCategory, VendorProfile, VendorSubscription } from '@/types/database'

interface AdminVendorDetailData {
  vendor:          VendorProfile
  categories:      VendorCategory[]
  portfolio_count: number
  subscriptions:   VendorSubscription[]
  admin_actions:   VendorAdminAction[]
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

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '16px', padding: '20px 22px', marginBottom: '16px',
  boxShadow: '0 4px 16px rgba(60,40,24,0.06)',
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const ACTION_LABEL: Record<string, string> = {
  approve:    'Aprovar',
  reject:     'Rejeitar',
  suspend:    'Suspender',
  reactivate: 'Reativar',
  pause:      'Pausar',
}

const ACTION_HISTORY_LABEL: Record<string, string> = {
  approve:     'Aprovado',
  reject:      'Rejeitado',
  suspend:     'Suspenso',
  reactivate:  'Reativado',
  pause:       'Pausado',
  featured:    'Marcado como destaque',
  unfeatured:  'Removido do destaque',
}

// Ações disponíveis por status — mesmo mapa de ALLOWED_FROM_STATUS do servidor
// (.../admin/vendors/[id]/status/route.ts), duplicado aqui só pra decidir quais
// botões mostrar; o servidor sempre revalida de qualquer forma.
const ACTIONS_BY_STATUS: Record<string, string[]> = {
  pending_review: ['approve', 'reject'],
  active:         ['suspend', 'pause'],
  paused:         ['suspend', 'reactivate'],
  suspended:      ['reactivate'],
  draft:          [],
  rejected:       [],
}

const CRITICAL_ACTIONS = new Set(['reject', 'suspend'])

export default function AdminVendorDetail({ vendorId }: { vendorId: string }) {
  const [data, setData]         = useState<AdminVendorDetailData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [acting, setActing]     = useState<string | null>(null)
  const [reason, setReason]     = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // setLoading nunca é chamado sincronamente no topo (só depois do fetch) — `loading`
  // já nasce `true` via useState acima, então o efeito de montagem abaixo não precisa
  // disparar setState antes de qualquer await (react-hooks/set-state-in-effect).
  async function load() {
    const res = await fetch(`/api/v1/admin/vendors/${vendorId}`)
    const body = (await res.json().catch(() => null)) as { data?: AdminVendorDetailData; error?: { message: string } } | null
    setLoading(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível carregar o fornecedor.')
      return
    }
    setData(body?.data ?? null)
  }

  useEffect(() => {
    // setTimeout evita o lint react-hooks/set-state-in-effect (o linter não consegue
    // provar estaticamente que `load`, uma função nomeada no escopo do componente e
    // reutilizada por outros handlers, nunca chama setState antes de um await) — mesmo
    // padrão de debounce já usado em admin-vendors-manager.tsx, aqui só sem delay real.
    const timeout = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez, ao montar
  }, [])

  async function runAction(action: string) {
    if (CRITICAL_ACTIONS.has(action) && !reason.trim()) {
      toastError('Informe o motivo antes de confirmar essa ação.')
      return
    }
    if (!window.confirm(`Confirma "${ACTION_LABEL[action]}" para este fornecedor?`)) return

    setActing(action)
    const res = await fetch(`/api/v1/admin/vendors/${vendorId}/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, reason: reason.trim() || undefined }),
    })
    setActing(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível concluir a ação.'))
      return
    }

    toastSuccess('Ação concluída.')
    setReason('')
    setPendingAction(null)
    void load()
  }

  async function toggleFeatured(next: boolean) {
    setActing('feature')
    const res = await fetch(`/api/v1/admin/vendors/${vendorId}/feature`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ featured: next }),
    })
    setActing(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar o destaque.'))
      return
    }
    void load()
  }

  if (loading) return <p style={{ color: '#8A7D6E' }}>Carregando…</p>
  if (!data) return <p style={{ color: '#8A7D6E' }}>Fornecedor não encontrado.</p>

  const { vendor, categories, portfolio_count, subscriptions, admin_actions } = data
  const availableActions = ACTIONS_BY_STATUS[vendor.status] ?? []

  return (
    <div>
      <Link href="/admin/fornecedores" style={{ fontSize: '13px', color: '#8A5A2E', textDecoration: 'none' }}>← Fornecedores</Link>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', margin: '10px 0 20px' }}>
        <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: '#3C2818', margin: 0 }}>{vendor.business_name}</h1>
        <Link href={`/profissionais/${vendor.slug}`} target="_blank" style={{ fontSize: '13px', color: '#8A5A2E' }}>Ver perfil público →</Link>
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#8A7D6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Dados</p>
        <p style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>Status: <strong>{vendor.status}</strong></p>
        <p style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>Cidade: {[vendor.city, vendor.state].filter(Boolean).join(' - ') || '—'}</p>
        <p style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>Categorias: {categories.map((c) => c.label).join(', ') || '—'}</p>
        <p style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>Portfólio: {portfolio_count} foto(s)</p>
        <p style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>WhatsApp: {vendor.whatsapp || '—'} · Telefone: {vendor.phone || '—'}</p>
        {vendor.rejection_reason && (
          <p style={{ fontSize: '13px', color: '#C0553F', margin: '8px 0 0' }}>Motivo registrado: {vendor.rejection_reason}</p>
        )}

        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            onClick={() => toggleFeatured(!vendor.featured)}
            disabled={acting !== null}
            style={{
              border: `1.5px solid ${vendor.featured ? '#B8862F' : '#E4D8C8'}`, borderRadius: '10px', padding: '8px 14px',
              background: vendor.featured ? '#FBF1DE' : '#fff', color: '#8A5A2E', fontWeight: 700, fontSize: '13px',
              cursor: acting !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {vendor.featured ? '★ Remover destaque' : '☆ Marcar como destaque'}
          </button>
        </div>
      </div>

      {availableActions.length > 0 && (
        <div style={cardStyle}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#8A7D6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Ações</p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {availableActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  if (CRITICAL_ACTIONS.has(action)) {
                    setPendingAction(action)
                    return
                  }
                  void runAction(action)
                }}
                disabled={acting !== null}
                style={{
                  border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 700, fontSize: '13.5px',
                  background: action === 'approve' ? '#5E8B6A' : action === 'reject' || action === 'suspend' ? '#C0553F' : '#8A5A2E',
                  color: '#fff', cursor: acting !== null ? 'not-allowed' : 'pointer', opacity: acting !== null ? 0.6 : 1,
                }}
              >
                {acting === action ? 'Aplicando…' : ACTION_LABEL[action]}
              </button>
            ))}
          </div>

          {pendingAction && (
            <div style={{ marginTop: '10px' }}>
              <label htmlFor="admin-vendor-reason" style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }}>
                Motivo (obrigatório para {ACTION_LABEL[pendingAction]?.toLowerCase()})
              </label>
              <textarea
                id="admin-vendor-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ width: '100%', border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '10px 13px', fontSize: '14px', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => runAction(pendingAction)}
                  disabled={acting !== null}
                  style={{ border: 'none', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', background: '#C0553F', color: '#fff', cursor: 'pointer' }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingAction(null); setReason('') }}
                  style={{ border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', background: '#fff', color: '#3C2818', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#8A7D6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Assinaturas</p>
        {subscriptions.length === 0 && <p style={{ fontSize: '13.5px', color: '#8A7D6E' }}>Nenhuma assinatura ainda.</p>}
        {subscriptions.map((sub) => (
          <p key={sub.id} style={{ fontSize: '13.5px', color: '#3C2818', margin: '4px 0' }}>
            {sub.plan_id} — {sub.status}{sub.cancel_at_period_end ? ' (cancelamento agendado)' : ''} · desde {fmtDateTime(sub.created_at)}
          </p>
        ))}
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#8A7D6E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Histórico de ações do admin</p>
        {admin_actions.length === 0 && <p style={{ fontSize: '13.5px', color: '#8A7D6E' }}>Nenhuma ação registrada ainda.</p>}
        {admin_actions.map((action) => (
          <p key={action.id} style={{ fontSize: '13px', color: '#3C2818', margin: '4px 0' }}>
            {fmtDateTime(action.created_at)} — {ACTION_HISTORY_LABEL[action.action] ?? action.action}
            {action.reason && ` (${action.reason})`}
          </p>
        ))}
      </div>
    </div>
  )
}
