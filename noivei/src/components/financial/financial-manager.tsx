'use client'

import { useState } from 'react'

import CurrencyInput from '@/components/ui/currency-input'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import type { FinancialEntry } from '@/types/database'

interface FinancialManagerProps {
  weddingId:      string
  budgetCents:    number | null
  initialEntries: FinancialEntry[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface EntryForm {
  category:     string
  description:  string
  vendor:       string
  total_amount: number | null
  paid_amount:  number | null
  due_date:     string
}

const EMPTY_FORM: EntryForm = {
  category: '', description: '', vendor: '', total_amount: null, paid_amount: null, due_date: '',
}

const CATEGORY_SUGGESTIONS = [
  'Espaço & Buffet', 'Fotografia & Vídeo', 'Decoração & Flores', 'Música & Festa',
  'Vestido & Traje', 'Beleza', 'Convites & Papelaria', 'Doces & Bolo', 'Lua de mel', 'Outros',
]

const CATEGORY_COLORS = ['#C6943A', '#C89070', '#5E8B6A', '#A87050', '#9A7020', '#C0553F', '#3B82F6', '#E0B870']

function fmt(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
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

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

export default function FinancialManager({ weddingId, budgetCents, initialEntries }: FinancialManagerProps) {
  const [entries, setEntries]     = useState<FinancialEntry[]>(initialEntries)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<FinancialEntry | null>(null)
  const [form, setForm]           = useState<EntryForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  // Validação local de negócio (pago > total) — mantida no formulário, não é resultado de ação de rede
  const [formError, setFormError] = useState('')
  const showSpinner = useDelayedLoading(saving)

  const apiBase = `/api/v1/weddings/${weddingId}/financial`

  const budget    = budgetCents ?? 0
  const committed = entries.reduce((sum, e) => sum + e.total_amount, 0)
  const paid      = entries.reduce((sum, e) => sum + e.paid_amount, 0)
  const pct       = budget > 0 ? Math.min(100, Math.round((committed / budget) * 100)) : 0
  const available = budget - committed

  const categories = [...new Set(entries.map((e) => e.category))].map((name, i) => {
    const inCategory = entries.filter((e) => e.category === name)
    return {
      name,
      total: inCategory.reduce((s, e) => s + e.total_amount, 0),
      paid:  inCategory.reduce((s, e) => s + e.paid_amount, 0),
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(entry: FinancialEntry) {
    setEditing(entry)
    setForm({
      category:     entry.category,
      description:  entry.description ?? '',
      vendor:       entry.vendor ?? '',
      total_amount: entry.total_amount,
      paid_amount:  entry.paid_amount,
      due_date:     entry.due_date ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const total = form.total_amount ?? 0
    const paidValue = form.paid_amount ?? 0
    if (paidValue > total) {
      setFormError('Valor pago não pode exceder o valor total.')
      return
    }

    setSaving(true)
    setFormError('')

    const payload = {
      category:     form.category.trim(),
      description:  form.description.trim(),
      vendor:       form.vendor.trim() || null,
      total_amount: total,
      paid_amount:  paidValue,
      due_date:     form.due_date || null,
    }

    const res = editing
      ? await fetch(`${apiBase}/${editing.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
      : await fetch(apiBase, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })

    setSaving(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o lançamento.'))
      return
    }

    const { data } = (await res.json()) as { data: FinancialEntry }
    setEntries((prev) =>
      editing ? prev.map((entry) => (entry.id === data.id ? data : entry)) : [...prev, data],
    )
    setModalOpen(false)
  }

  async function handleDelete(entry: FinancialEntry) {
    if (!window.confirm(`Excluir o lançamento "${entry.description || entry.category}"?`)) return

    const previous = entries
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))

    const res = await fetch(`${apiBase}/${entry.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setEntries(previous)
      toastError(await readApiError(res, 'Não foi possível excluir o lançamento.'))
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Financeiro
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Controle o orçamento do seu casamento
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Lançar gasto
        </button>
      </div>

      {/* Hero card */}
      <div
        className="relative mb-6 overflow-hidden rounded-3xl p-8"
        style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)', backgroundSize: '28px 28px' }}
        />
        <div className="relative">
          <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-light)', marginBottom: '4px' }}>
            Orçamento total
          </div>
          <div className="font-display" style={{ fontSize: 'clamp(42px,6vw,60px)', fontWeight: 500, lineHeight: 1, marginBottom: '16px' }}>
            {fmt(budget)}
          </div>

          <div style={{ height: '10px', borderRadius: '99px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: '8px' }}>
            <div
              style={{
                height: '100%', borderRadius: '99px',
                background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color))',
                width: `${pct}%`, transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(250,240,230,0.65)', marginBottom: '20px' }}>
            {pct}% do orçamento comprometido
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Comprometido', value: fmt(committed), color: 'var(--wedding-color-light)' },
              { label: 'Pago',         value: fmt(paid),      color: '#A8C8A0' },
              { label: 'Disponível',   value: fmt(available), color: available < 0 ? '#E8A090' : 'rgba(250,240,230,0.65)' },
            ].map((mc) => (
              <div
                key={mc.label}
                style={{
                  padding: '12px 18px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(250,240,230,0.55)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {mc.label}
                </div>
                <div className="font-display" style={{ fontSize: '22px', fontWeight: 500, color: mc.color }}>
                  {mc.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))' }}>
        {/* Categories */}
        <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h3 className="font-display mb-5" style={{ fontSize: '21px', fontWeight: 500, color: 'var(--fg)' }}>
            Por categoria
          </h3>
          <div className="flex flex-col gap-4">
            {categories.length === 0 && (
              <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)' }}>Nenhuma categoria lançada ainda.</p>
            )}
            {categories.map((cat) => {
              const catPct = cat.total > 0 ? Math.round((cat.paid / cat.total) * 100) : 0
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--fg)' }}>{cat.name}</span>
                    <span style={{ fontSize: '12.5px', color: 'var(--muted-fg)' }}>
                      {fmt(cat.paid)} / {fmt(cat.total)}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '99px', background: '#F0E8DE', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%', borderRadius: '99px',
                        background: cat.color,
                        width: `${catPct}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Entries */}
        <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h3 className="font-display mb-5" style={{ fontSize: '21px', fontWeight: 500, color: 'var(--fg)' }}>
            Lançamentos
          </h3>
          <div className="flex flex-col gap-3">
            {entries.length === 0 && (
              <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)' }}>Nenhum lançamento ainda.</p>
            )}
            {entries.map((entry) => {
              const fullyPaid = entry.total_amount > 0 && entry.paid_amount >= entry.total_amount
              const due = formatDue(entry.due_date)
              const subtitle = [entry.category, entry.vendor, due ? `vence ${due}` : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 rounded-xl p-4"
                  style={{ background: 'var(--wedding-color-subtle)', border: '1px solid #F0E8DE' }}
                >
                  <div
                    style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: fullyPaid ? '#E9EFE6' : '#F1E6D4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title={fullyPaid ? 'Pago' : 'Pagamento em aberto'}
                  >
                    {fullyPaid ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E8B6A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A7020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>
                      {entry.description || entry.category}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                      {subtitle}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>{fmt(entry.total_amount)}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                      pago {fmt(entry.paid_amount)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(entry)}
                      title="Editar lançamento"
                      aria-label={`Editar ${entry.description || entry.category}`}
                      style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      title="Excluir lançamento"
                      aria-label={`Excluir ${entry.description || entry.category}`}
                      style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal de lançamento */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="entry-category" style={labelStyle}>Categoria *</label>
            <input
              id="entry-category"
              type="text"
              required
              maxLength={80}
              list="entry-category-suggestions"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Espaço & Buffet"
              style={inputStyle}
            />
            <datalist id="entry-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="entry-description" style={labelStyle}>Descrição</label>
            <input
              id="entry-description"
              type="text"
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Sinal do buffet"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="entry-vendor" style={labelStyle}>Fornecedor</label>
            <input
              id="entry-vendor"
              type="text"
              maxLength={120}
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              placeholder="Buffet Jardim das Flores"
              style={inputStyle}
            />
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label htmlFor="entry-total" style={labelStyle}>Valor total *</label>
              <CurrencyInput
                id="entry-total"
                value={form.total_amount}
                onChange={(cents) => setForm((f) => ({ ...f, total_amount: cents }))}
              />
            </div>
            <div>
              <label htmlFor="entry-paid" style={labelStyle}>Valor pago</label>
              <CurrencyInput
                id="entry-paid"
                value={form.paid_amount}
                onChange={(cents) => setForm((f) => ({ ...f, paid_amount: cents }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="entry-due" style={labelStyle}>Vencimento</label>
            <input
              id="entry-due"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {formError && (
            <p role="alert" style={{ fontSize: '13.5px', color: '#C0553F', margin: 0 }}>{formError}</p>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{
                background: 'transparent', color: 'var(--muted-fg)', border: 'none',
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
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 18px',
                fontWeight: 600, fontSize: '14px',
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {showSpinner && <Spinner color="#fff" />} {editing ? 'Salvar' : 'Lançar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
