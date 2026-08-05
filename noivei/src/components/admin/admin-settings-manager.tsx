'use client'

import { useState } from 'react'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'

interface AdminSettingsManagerProps {
  initialPlatformFeePercent: number
  initialAccountPurgeDays: number
}

export default function AdminSettingsManager({ initialPlatformFeePercent, initialAccountPurgeDays }: AdminSettingsManagerProps) {
  const [feePercent, setFeePercent]     = useState(initialPlatformFeePercent)
  const [purgeDays, setPurgeDays]       = useState(initialAccountPurgeDays)
  const [saving, setSaving]             = useState(false)
  const showSpinner = useDelayedLoading(saving)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    const res = await fetch('/api/v1/admin/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ platform_fee_percent: feePercent, account_purge_days: purgeDays }),
    })
    const body = await res.json().catch(() => null) as {
      data?: { platform_fee_percent: number; account_purge_days: number }
      error?: { message: string }
    } | null

    setSaving(false)
    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível salvar.')
      return
    }

    setFeePercent(body!.data!.platform_fee_percent)
    setPurgeDays(body!.data!.account_purge_days)
    toastSuccess('Configuração salva!')
  }

  return (
    <div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '0 0 6px' }}
      >
        Configurações
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 28px' }}>
        Parâmetros globais da plataforma.
      </p>

      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '480px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>
          Comissão sobre presentes pagos pelo app
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Quando um convidado paga um presente pelo app (Mercado Pago, direto na conta do casal), a Wednest
          retém essa porcentagem automaticamente em cada pagamento (marketplace_fee) — o restante cai direto
          na conta do casal. Mínimo 0%, máximo 10%.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label htmlFor="platform-fee" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px' }}>
              Comissão (%)
            </label>
            <input
              id="platform-fee"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={feePercent}
              onChange={(e) => setFeePercent(Math.min(10, Math.max(0, Number(e.target.value))))}
              style={{
                border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
                fontSize: '15px', color: 'var(--fg)', background: 'var(--bg)', outline: 'none', width: '140px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '11px 18px', fontWeight: 700, fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, width: 'fit-content',
            }}
          >
            {showSpinner && <Spinner color="#fff" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>

      <div
        className="rounded-2xl bg-[var(--surface)] p-6"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '480px', marginTop: '20px' }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>
          Prazo de expurgo definitivo (dias)
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Quantos dias depois que uma conta é excluída até os dados serem apagados definitivamente do
          Storage e do banco — não pode ser alterado com efeito retroativo em contas já expurgadas.
          Mínimo 7, máximo 365. Hoje: 30 dias.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label htmlFor="account-purge-days" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px' }}>
              Prazo (dias)
            </label>
            <input
              id="account-purge-days"
              type="number"
              min={7}
              max={365}
              step={1}
              value={purgeDays}
              onChange={(e) => setPurgeDays(Math.min(365, Math.max(7, Math.trunc(Number(e.target.value)))))}
              style={{
                border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
                fontSize: '15px', color: 'var(--fg)', background: 'var(--bg)', outline: 'none', width: '140px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '11px 18px', fontWeight: 700, fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, width: 'fit-content',
            }}
          >
            {showSpinner && <Spinner color="#fff" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
