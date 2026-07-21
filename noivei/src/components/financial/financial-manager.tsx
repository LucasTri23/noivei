'use client'

import { useState } from 'react'
import Link from 'next/link'

import CurrencyInput from '@/components/ui/currency-input'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { isPaidPlan, isPlusPlan, type PlanId } from '@/constants/plans'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { QUOTE_TYPES, QUOTE_TYPE_LABELS } from '@/lib/api/validation/financial-quote.schema'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { FinancialEntry, FinancialQuote, FinancialQuoteType } from '@/types/database'

interface FinancialManagerProps {
  weddingId:      string
  budgetCents:    number | null
  initialEntries: FinancialEntry[]
  initialQuotes:  FinancialQuote[]
  planId:         PlanId
  entryLimit:     number
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

interface QuoteForm {
  type:         FinancialQuoteType
  vendor_name:  string
  amount_cents: number | null
  notes:        string
}

const EMPTY_QUOTE_FORM: QuoteForm = {
  type: 'local', vendor_name: '', amount_cents: null, notes: '',
}

const CATEGORY_SUGGESTIONS = [
  'Espaço & Buffet', 'Fotografia & Vídeo', 'Decoração & Flores', 'Música & Festa',
  'Vestido & Traje', 'Beleza', 'Convites & Papelaria', 'Doces & Bolo', 'Lua de mel', 'Outros',
]

const CATEGORY_COLORS = ['#C6943A', '#C89070', '#5E8B6A', '#A87050', '#9A7020', '#C0553F', '#3B82F6', '#E0B870']

function fmt(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function parseDueDate(dueDate: string): Date | null {
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const parsed = parseDueDate(dueDate)
  if (!parsed) return null
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
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
function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
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

export default function FinancialManager({ weddingId, budgetCents, initialEntries, initialQuotes, planId, entryLimit }: FinancialManagerProps) {
  const [entries, setEntries]     = useState<FinancialEntry[]>(initialEntries)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<FinancialEntry | null>(null)
  const [form, setForm]           = useState<EntryForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  // Validação local de negócio (pago > total) — mantida no formulário, não é resultado de ação de rede
  const [formError, setFormError] = useState('')
  const showSpinner = useDelayedLoading(saving)

  const [quotes, setQuotes]                 = useState<FinancialQuote[]>(initialQuotes)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteForm, setQuoteForm]           = useState<QuoteForm>(EMPTY_QUOTE_FORM)
  const [savingQuote, setSavingQuote]       = useState(false)
  const [selectingId, setSelectingId]       = useState<string | null>(null)
  const showQuoteSpinner = useDelayedLoading(savingQuote)

  const apiBase      = `/api/v1/weddings/${weddingId}/financial`
  const quotesApiBase = `/api/v1/weddings/${weddingId}/financial-quotes`

  const isPaid  = isPaidPlan(planId)
  const isPlus  = isPlusPlan(planId)
  const atLimit = entries.length >= entryLimit

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

  // Orçamentos agrupados por tipo, na ordem fixa de QUOTE_TYPES (não na ordem de criação),
  // pra manter as seções sempre no mesmo lugar conforme o casal adiciona/remove cotações.
  const quoteGroups = QUOTE_TYPES
    .map((type) => ({ type, label: QUOTE_TYPE_LABELS[type], items: quotes.filter((q) => q.type === type) }))
    .filter((group) => group.items.length > 0)

  // Relatório avançado (Premium Plus): próximos vencimentos ainda não quitados,
  // incluindo os já vencidos (para destacá-los), até 30 dias à frente.
  const today   = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 30)

  const upcomingDue = isPlus
    ? entries
        .filter((e) => e.due_date !== null && e.paid_amount < e.total_amount)
        .map((e) => ({ entry: e, dueDate: parseDueDate(e.due_date as string) }))
        .filter((x): x is { entry: FinancialEntry; dueDate: Date } => x.dueDate !== null && x.dueDate <= horizon)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    : []

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

  function openCreateQuote() {
    setQuoteForm(EMPTY_QUOTE_FORM)
    setQuoteModalOpen(true)
  }

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault()
    if (savingQuote) return

    setSavingQuote(true)

    const payload = {
      type:         quoteForm.type,
      vendor_name:  quoteForm.vendor_name.trim(),
      amount_cents: quoteForm.amount_cents ?? 0,
      notes:        quoteForm.notes.trim() || null,
    }

    const res = await fetch(quotesApiBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    setSavingQuote(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar o orçamento.'))
      return
    }

    const { data } = (await res.json()) as { data: FinancialQuote }
    setQuotes((prev) => [...prev, data])
    setQuoteModalOpen(false)
  }

  async function handleDeleteQuote(quote: FinancialQuote) {
    if (!window.confirm(`Excluir o orçamento "${quote.vendor_name}"?`)) return

    const previousQuotes  = quotes
    const previousEntries = entries
    setQuotes((prev) => prev.filter((q) => q.id !== quote.id))
    if (quote.financial_entry_id) {
      setEntries((prev) => prev.filter((e) => e.id !== quote.financial_entry_id))
    }

    const res = await fetch(`${quotesApiBase}/${quote.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setQuotes(previousQuotes)
      setEntries(previousEntries)
      toastError(await readApiError(res, 'Não foi possível excluir o orçamento.'))
    }
  }

  // Ao trocar a seleção dentro do mesmo tipo, o orçamento antigo perde o vínculo com o
  // lançamento (removido no servidor) — guardamos aqui, antes da chamada, pra também
  // tirar esse lançamento antigo do estado local sem esperar um reload da página.
  async function handleSelectQuote(quote: FinancialQuote) {
    if (selectingId) return

    const previousSelected = quotes.find((q) => q.type === quote.type && q.is_selected && q.id !== quote.id)

    setSelectingId(quote.id)
    const res = await fetch(`${quotesApiBase}/${quote.id}/select`, { method: 'POST' })
    setSelectingId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível selecionar este orçamento.'))
      return
    }

    const { data } = (await res.json()) as { data: { quote: FinancialQuote; entry: FinancialEntry } }

    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === data.quote.id) return data.quote
        if (previousSelected && q.id === previousSelected.id) return { ...q, is_selected: false, financial_entry_id: null }
        return q
      }),
    )
    setEntries((prev) => {
      const withoutOld = previousSelected?.financial_entry_id
        ? prev.filter((e) => e.id !== previousSelected.financial_entry_id)
        : prev
      return [...withoutOld, data.entry]
    })

    const hasChecklistTask = quote.type === 'local' || quote.type === 'buffet'
    toastSuccess(
      hasChecklistTask
        ? 'Orçamento selecionado! O lançamento foi criado no Financeiro e a tarefa do Checklist foi marcada como concluída.'
        : 'Orçamento selecionado! O lançamento foi criado no Financeiro.',
    )
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
          disabled={atLimit}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px',
            cursor: atLimit ? 'not-allowed' : 'pointer',
            opacity: atLimit ? 0.5 : 1,
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Lançar gasto
        </button>
      </div>

      {/* Aviso de limite do plano */}
      {atLimit && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{
            background: '#FBF0E0', border: '1px solid #E0B870',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
            fontSize: '14px', color: '#9A7020',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Você atingiu o limite de {entryLimit} lançamentos financeiros do seu plano.
          </span>
          <Link
            href="/perfil/planos"
            style={{ fontWeight: 700, color: '#9A7020', textDecoration: 'underline' }}
          >
            Fazer upgrade para lançar mais gastos
          </Link>
        </div>
      )}

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
        {/* Categories — recurso Completo (Premium+); Gratuito vê só o teaser */}
        {isPaid ? (
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
        ) : (
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)', backgroundSize: '26px 26px' }}
            />
            <div className="relative">
              <div
                className="flex items-center justify-center"
                style={{
                  width: '46px', height: '46px', borderRadius: '14px', marginBottom: '14px',
                  background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)',
                  color: 'var(--wedding-color-light)',
                }}
              >
                <LockIcon />
              </div>
              <h3 className="font-display mb-2" style={{ fontSize: '21px', fontWeight: 500, color: '#FAF0E6' }}>
                Por categoria
              </h3>
              <p style={{ fontSize: '13.5px', color: 'rgba(250,240,230,0.65)', lineHeight: 1.6, marginBottom: '18px' }}>
                Veja o breakdown completo do orçamento por categoria, com barras de progresso de pago x total.
                Disponível no Premium.
              </p>
              <Link
                href="/perfil/planos"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'var(--wedding-color-light)', color: '#2A1E10', border: 'none',
                  borderRadius: '12px', padding: '10px 18px',
                  fontWeight: 700, fontSize: '13.5px', textDecoration: 'none',
                }}
              >
                Ver planos e fazer upgrade
              </Link>
            </div>
          </div>
        )}

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

      {/* Orçamentos por categoria — recurso Completo (Premium+): cadastra várias cotações
          por tipo (ex.: 3 espaços) e escolhe uma, que vira lançamento real no Financeiro. */}
      {isPaid && (
        <div className="mt-5 rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display" style={{ fontSize: '21px', fontWeight: 500, color: 'var(--fg)' }}>
                Orçamentos
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '4px' }}>
                Cadastre cotações por categoria (espaço, buffet...) e escolha uma de cada
              </p>
            </div>
            <button
              onClick={openCreateQuote}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 16px',
                fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
              }}
            >
              <PlusIcon /> Adicionar orçamento
            </button>
          </div>

          {quoteGroups.length === 0 ? (
            <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)' }}>Nenhum orçamento cadastrado ainda.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {quoteGroups.map((group) => (
                <div key={group.type}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    {group.label}
                  </h4>
                  <div className="flex flex-col gap-3">
                    {group.items.map((quote) => (
                      <div
                        key={quote.id}
                        className="flex flex-wrap items-center gap-4 rounded-xl p-4"
                        style={{
                          background: quote.is_selected ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                          border: `1px solid ${quote.is_selected ? 'var(--wedding-color-light)' : '#F0E8DE'}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>{quote.vendor_name}</span>
                            {quote.is_selected && (
                              <span
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  fontSize: '11px', fontWeight: 700, color: '#5E8B6A',
                                  background: '#E9EFE6', borderRadius: '99px', padding: '2px 9px',
                                }}
                              >
                                <CheckCircleIcon /> Selecionado
                              </span>
                            )}
                          </div>
                          {quote.notes && (
                            <div style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '2px' }}>{quote.notes}</div>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)', flexShrink: 0 }}>
                          {fmt(quote.amount_cents)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          {!quote.is_selected && (
                            <button
                              onClick={() => handleSelectQuote(quote)}
                              disabled={selectingId === quote.id}
                              style={{
                                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                                borderRadius: '10px', padding: '8px 14px', fontWeight: 600, fontSize: '13px',
                                cursor: selectingId === quote.id ? 'wait' : 'pointer',
                                opacity: selectingId === quote.id ? 0.7 : 1,
                              }}
                            >
                              {selectingId === quote.id ? 'Selecionando...' : 'Escolher este'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteQuote(quote)}
                            title="Excluir orçamento"
                            aria-label={`Excluir orçamento ${quote.vendor_name}`}
                            style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Próximos vencimentos — relatório avançado exclusivo do Premium Plus */}
      {isPlus && (
        <div className="mt-5 rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h3 className="font-display mb-1" style={{ fontSize: '21px', fontWeight: 500, color: 'var(--fg)' }}>
            Próximos vencimentos
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginBottom: '18px' }}>
            Lançamentos em aberto que vencem nos próximos 30 dias, incluindo os já vencidos
          </p>
          {upcomingDue.length === 0 ? (
            <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)' }}>Nenhum vencimento em aberto nos próximos 30 dias.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingDue.map(({ entry, dueDate }) => {
                const overdue = dueDate < today
                const remaining = entry.total_amount - entry.paid_amount
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 rounded-xl p-4"
                    style={{
                      background: overdue ? '#F6E4DE' : 'var(--wedding-color-subtle)',
                      border: `1px solid ${overdue ? '#E8C4B8' : '#F0E8DE'}`,
                    }}
                  >
                    <div style={{ color: overdue ? '#C0553F' : '#9A7020', flexShrink: 0 }}>
                      <AlertIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>
                        {entry.description || entry.category}
                      </div>
                      <div style={{ fontSize: '12px', color: overdue ? '#C0553F' : 'var(--muted-fg)', marginTop: '2px', fontWeight: overdue ? 700 : 400 }}>
                        {overdue ? 'Vencido em ' : 'Vence em '}
                        {formatDue(entry.due_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>{fmt(remaining)}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                        em aberto
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
          {/* Fornecedor é recurso Completo (Premium+) — no Gratuito o campo fica oculto, mas o
              valor de um lançamento antigo (form.vendor) segue sendo enviado sem alteração,
              então editar outros campos não apaga um vendor já salvo. */}
          {isPaid && (
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
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Modal de orçamento */}
      <Modal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        title="Novo orçamento"
      >
        <form onSubmit={handleSubmitQuote} className="flex flex-col gap-4">
          <div>
            <label htmlFor="quote-type" style={labelStyle}>Categoria *</label>
            <select
              id="quote-type"
              required
              value={quoteForm.type}
              onChange={(e) => setQuoteForm((f) => ({ ...f, type: e.target.value as FinancialQuoteType }))}
              style={inputStyle}
            >
              {QUOTE_TYPES.map((type) => (
                <option key={type} value={type}>{QUOTE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quote-vendor" style={labelStyle}>Fornecedor/local *</label>
            <input
              id="quote-vendor"
              type="text"
              required
              maxLength={160}
              value={quoteForm.vendor_name}
              onChange={(e) => setQuoteForm((f) => ({ ...f, vendor_name: e.target.value }))}
              placeholder="Espaço Jardim das Flores"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="quote-amount" style={labelStyle}>Valor cotado *</label>
            <CurrencyInput
              id="quote-amount"
              value={quoteForm.amount_cents}
              onChange={(cents) => setQuoteForm((f) => ({ ...f, amount_cents: cents }))}
            />
          </div>
          <div>
            <label htmlFor="quote-notes" style={labelStyle}>Observações</label>
            <input
              id="quote-notes"
              type="text"
              maxLength={1000}
              value={quoteForm.notes}
              onChange={(e) => setQuoteForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Inclui decoração básica"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setQuoteModalOpen(false)}
              style={{
                background: 'transparent', color: 'var(--muted-fg)', border: 'none',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: '10px 14px',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingQuote}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 18px',
                fontWeight: 600, fontSize: '14px',
                cursor: savingQuote ? 'wait' : 'pointer', opacity: savingQuote ? 0.7 : 1,
              }}
            >
              {showQuoteSpinner && <Spinner color="#fff" />} Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
