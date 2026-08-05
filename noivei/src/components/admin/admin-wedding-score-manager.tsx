'use client'

import { useState } from 'react'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'

interface WeddingScoreConfigForm {
  enabled:           boolean
  title:             string
  description:       string
  label_low:         string
  description_low:   string
  label_mid:         string
  description_mid:   string
  label_high:        string
  description_high:  string
}

interface ModuleWeightRow {
  module_key: string
  label:      string
  weight:     number
  sort_order: number
}

interface AdminWeddingScoreManagerProps {
  initialConfig:  WeddingScoreConfigForm
  initialWeights: ModuleWeightRow[]
}

interface ApiErrorBody {
  error?: { message?: string }
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
  fontSize: '14.5px', color: 'var(--fg)', background: 'var(--bg)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export default function AdminWeddingScoreManager({ initialConfig, initialWeights }: AdminWeddingScoreManagerProps) {
  const [config, setConfig]   = useState<WeddingScoreConfigForm>(initialConfig)
  const [weights, setWeights] = useState<ModuleWeightRow[]>(initialWeights)
  const [saving, setSaving]   = useState(false)
  const showSpinner = useDelayedLoading(saving)

  const weightSum = weights.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0)

  function updateWeight(moduleKey: string, value: number) {
    setWeights((prev) => prev.map((row) => (row.module_key === moduleKey ? { ...row, weight: value } : row)))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    const res = await fetch('/api/v1/admin/wedding-score-config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...config,
        weights: weights.map((row) => ({ module_key: row.module_key, weight: row.weight })),
      }),
    })
    const body = await res.json().catch(() => null) as ({
      data?: { config: WeddingScoreConfigForm; weights: ModuleWeightRow[] }
    } & ApiErrorBody) | null

    setSaving(false)
    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível salvar.')
      return
    }

    if (body?.data) {
      setConfig(body.data.config)
      setWeights(body.data.weights)
    }
    toastSuccess('Wedding Score atualizado!')
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      {/* Kill switch global */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '640px' }}>
        <label className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
            style={{ width: '18px', height: '18px', accentColor: '#2A1E10', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)' }}>Wedding Score ativado</span>
        </label>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '8px 0 0 30px' }}>
          Kill switch global: quando desligado, o card e o teaser somem do Dashboard para todo mundo,
          independente do plano ou permissão do casamento.
        </p>
      </div>

      {/* Textos do card */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 18px' }}>
          Título e descrição
        </h2>
        <div className="flex flex-col gap-4">
          <Field label="Título">
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
              style={inputStyle}
              maxLength={120}
            />
          </Field>
          <Field label="Descrição (teaser bloqueado)">
            <textarea
              value={config.description}
              onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              maxLength={300}
            />
          </Field>
        </div>
      </div>

      {/* Níveis motivacionais */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>
          Níveis motivacionais
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Texto exibido conforme a faixa do score total: abaixo de 40, entre 40 e 70, e 70 ou mais. Os
          limiares (40/70) não são editáveis aqui.
        </p>
        <div className="flex flex-col gap-5">
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Abaixo de 40
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Rótulo">
                <input type="text" value={config.label_low} onChange={(e) => setConfig((prev) => ({ ...prev, label_low: e.target.value }))} style={inputStyle} maxLength={80} />
              </Field>
              <Field label="Descrição">
                <input type="text" value={config.description_low} onChange={(e) => setConfig((prev) => ({ ...prev, description_low: e.target.value }))} style={inputStyle} maxLength={300} />
              </Field>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Entre 40 e 70
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Rótulo">
                <input type="text" value={config.label_mid} onChange={(e) => setConfig((prev) => ({ ...prev, label_mid: e.target.value }))} style={inputStyle} maxLength={80} />
              </Field>
              <Field label="Descrição">
                <input type="text" value={config.description_mid} onChange={(e) => setConfig((prev) => ({ ...prev, description_mid: e.target.value }))} style={inputStyle} maxLength={300} />
              </Field>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              70 ou mais
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Rótulo">
                <input type="text" value={config.label_high} onChange={(e) => setConfig((prev) => ({ ...prev, label_high: e.target.value }))} style={inputStyle} maxLength={80} />
              </Field>
              <Field label="Descrição">
                <input type="text" value={config.description_high} onChange={(e) => setConfig((prev) => ({ ...prev, description_high: e.target.value }))} style={inputStyle} maxLength={300} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Pesos dos módulos */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>
          Peso de cada módulo
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          O cálculo normaliza pela soma real dos pesos — não precisa somar 100, mas ajuda a manter a
          proporção esperada entre os módulos.
        </p>
        <div className="flex flex-col gap-3">
          {weights.map((row) => (
            <div key={row.module_key} className="flex items-center justify-between gap-3">
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>{row.label}</span>
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                value={row.weight}
                onChange={(e) => updateWeight(row.module_key, Number(e.target.value))}
                style={{ ...inputStyle, width: '100px', textAlign: 'right' }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
            background: weightSum === 100 ? '#E9EFE6' : '#FBF0E0',
            color: weightSum === 100 ? '#5E8B6A' : '#9A7020',
            fontSize: '13px', fontWeight: 700,
          }}
        >
          Soma atual: {weightSum} — não precisa ser 100, mas ajuda a manter a proporção esperada.
        </div>
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
  )
}
