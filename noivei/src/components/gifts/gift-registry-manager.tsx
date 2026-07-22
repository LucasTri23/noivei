'use client'

import { useState } from 'react'

import CurrencyInput from '@/components/ui/currency-input'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import type { GiftRegistryItem, GiftRegistryType } from '@/types/database'

interface GiftRegistryManagerProps {
  weddingId:    string
  initialItems: GiftRegistryItem[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface ItemForm {
  name:        string
  description: string
  price_cents: number | null
  gift_type:   GiftRegistryType
  store_url:   string
  image_url:   string
}

const EMPTY_FORM: ItemForm = { name: '', description: '', price_cents: null, gift_type: 'link', store_url: '', image_url: '' }

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtPrice(cents: number | null): string {
  return cents == null ? 'Sem preço definido' : currencyFmt.format(cents / 100)
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
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  )
}
function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
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

export default function GiftRegistryManager({ weddingId, initialItems }: GiftRegistryManagerProps) {
  const [items, setItems]         = useState<GiftRegistryItem[]>(initialItems)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<GiftRegistryItem | null>(null)
  const [form, setForm]           = useState<ItemForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const showSaveSpinner           = useDelayedLoading(saving)

  const [giveModalOpen, setGiveModalOpen] = useState(false)
  const [givingItem, setGivingItem]       = useState<GiftRegistryItem | null>(null)
  const [givenBy, setGivenBy]             = useState('')
  const [givingSaving, setGivingSaving]   = useState(false)
  const showGiveSpinner = useDelayedLoading(givingSaving)

  const apiBase = `/api/v1/weddings/${weddingId}/gifts`

  const stats = {
    total:      items.length,
    dados:      items.filter((i) => i.is_purchased).length,
    disponiveis: items.filter((i) => !i.is_purchased).length,
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(item: GiftRegistryItem) {
    setEditing(item)
    setForm({
      name:        item.name,
      description: item.description ?? '',
      price_cents: item.price_cents,
      gift_type:   item.gift_type,
      store_url:   item.store_url ?? '',
      image_url:   item.image_url ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    const payload = {
      name:        form.name.trim(),
      description: form.description.trim() || null,
      price_cents: form.price_cents,
      gift_type:   form.gift_type,
      // Campo escondido para app_payment, mas não confiamos em estado de uma edição anterior
      store_url:   form.gift_type === 'app_payment' ? null : form.store_url.trim() || null,
      image_url:   form.image_url.trim() || null,
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
      toastError(await readApiError(res, 'Não foi possível salvar o item.'))
      return
    }

    const { data } = (await res.json()) as { data: GiftRegistryItem }
    setItems((prev) => (editing ? prev.map((i) => (i.id === data.id ? data : i)) : [...prev, data]))
    setModalOpen(false)
  }

  async function handleDelete(item: GiftRegistryItem) {
    if (!window.confirm(`Excluir "${item.name}" da lista de presentes?`)) return

    const previous = items
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    const res = await fetch(`${apiBase}/${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setItems(previous)
      toastError(await readApiError(res, 'Não foi possível excluir o item.'))
    }
  }

  function openGive(item: GiftRegistryItem) {
    setGivingItem(item)
    setGivenBy(item.purchased_by ?? '')
    setGiveModalOpen(true)
  }

  async function handleGiveSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (givingSaving || !givingItem) return
    setGivingSaving(true)

    const res = await fetch(`${apiBase}/${givingItem.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_purchased: true, purchased_by: givenBy.trim() || null }),
    })

    setGivingSaving(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível marcar o item como dado.'))
      return
    }

    const { data } = (await res.json()) as { data: GiftRegistryItem }
    setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)))
    setGiveModalOpen(false)
  }

  async function handleUndoGive(item: GiftRegistryItem) {
    const previous = items
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_purchased: false, purchased_by: null } : i)),
    )

    const res = await fetch(`${apiBase}/${item.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_purchased: false, purchased_by: null }),
    })

    if (!res.ok) {
      setItems(previous)
      toastError(await readApiError(res, 'Não foi possível desfazer a marcação.'))
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
            Lista de presentes
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Organize os itens da lista e marque manualmente o que já foi dado por convidados
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Item
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
        {[
          { label: 'Total',       value: stats.total,       color: 'var(--fg)' },
          { label: 'Já foi dado', value: stats.dados,       color: '#5E8B6A' },
          { label: 'Disponíveis', value: stats.disponiveis, color: 'var(--wedding-color-dark)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-[var(--surface)] p-5"
            style={{ boxShadow: '0 6px 18px rgba(60,40,24,0.07)', textAlign: 'center' }}
          >
            <div className="font-display" style={{ fontSize: '38px', fontWeight: 600, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '4px', fontWeight: 500 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Item list */}
      <div className="overflow-hidden rounded-2xl bg-[var(--surface)]" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-4 px-5 py-4"
            style={{ borderBottom: idx < items.length - 1 ? '1px solid #F8F3EE' : 'none' }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
                {fmtPrice(item.price_cents)}
                {item.description ? ` · ${item.description}` : ''}
              </div>
              {item.store_url && item.gift_type === 'link' && (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px',
                    fontSize: '12.5px', fontWeight: 600, color: 'var(--wedding-color)', textDecoration: 'none',
                  }}
                >
                  Ver na loja <ExternalLinkIcon />
                </a>
              )}
            </div>

            <span
              style={{
                fontSize: '12px', fontWeight: 600, padding: '5px 12px',
                borderRadius: '99px', flexShrink: 0,
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              }}
            >
              {item.gift_type === 'app_payment' ? 'Via app' : 'Via link'}
            </span>

            <span
              style={{
                fontSize: '12px', fontWeight: 600, padding: '5px 12px',
                borderRadius: '99px', flexShrink: 0,
                background: item.is_purchased ? '#E9EFE6' : 'var(--wedding-color-subtle)',
                color: item.is_purchased ? '#5E8B6A' : '#9A7A60',
              }}
            >
              {item.is_purchased
                ? `Já foi dado${item.purchased_by ? ` · ${item.purchased_by}` : ''}`
                : 'Disponível'}
            </span>

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {item.is_purchased ? (
                <button
                  onClick={() => handleUndoGive(item)}
                  title="Desfazer marcação"
                  aria-label={`Desfazer marcação de dado para ${item.name}`}
                  style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                >
                  <UndoIcon />
                </button>
              ) : (
                <button
                  onClick={() => openGive(item)}
                  title="Marcar como já foi dado"
                  aria-label={`Marcar ${item.name} como já foi dado`}
                  style={{ border: 'none', background: 'transparent', color: '#5E8B6A', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                >
                  <CheckIcon />
                </button>
              )}
              <button
                onClick={() => openEdit(item)}
                title="Editar item"
                aria-label={`Editar ${item.name}`}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
              >
                <PencilIcon />
              </button>
              <button
                onClick={() => handleDelete(item)}
                title="Excluir item"
                aria-label={`Excluir ${item.name}`}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            Nenhum item na lista de presentes ainda. Adicione o primeiro.
          </div>
        )}
      </div>

      {/* Modal de item (novo/editar) */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar item' : 'Novo item'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="gift-name" style={labelStyle}>Nome *</label>
            <input
              id="gift-name"
              type="text"
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Jogo de panelas"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="gift-description" style={labelStyle}>Descrição</label>
            <input
              id="gift-description"
              type="text"
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Panelas antiaderentes, conjunto com 5 peças"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="gift-price" style={labelStyle}>Preço</label>
            <CurrencyInput
              id="gift-price"
              value={form.price_cents}
              onChange={(cents) => setForm((f) => ({ ...f, price_cents: cents }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Como o convidado vai presentear?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="gift-type"
                  checked={form.gift_type === 'link'}
                  onChange={() => setForm((f) => ({ ...f, gift_type: 'link' }))}
                />
                Link de uma loja
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="gift-type"
                  checked={form.gift_type === 'app_payment'}
                  onChange={() => setForm((f) => ({ ...f, gift_type: 'app_payment' }))}
                />
                Pelo app · dinheiro cai na conta de vocês
              </label>
            </div>
            {form.gift_type === 'app_payment' && (
              <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '6px' }}>
                Presente simbólico — em breve os convidados vão poder pagar direto pelo app. Por enquanto, defina nome, preço e foto normalmente.
              </p>
            )}
          </div>
          {form.gift_type === 'link' && (
            <div>
              <label htmlFor="gift-store-url" style={labelStyle}>Link da loja</label>
              <input
                id="gift-store-url"
                type="url"
                maxLength={2048}
                value={form.store_url}
                onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))}
                placeholder="https://www.amazon.com.br/..."
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label htmlFor="gift-image-url" style={labelStyle}>Link da imagem</label>
            <input
              id="gift-image-url"
              type="url"
              maxLength={2048}
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

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
              {showSaveSpinner && <Spinner color="#fff" />} {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de marcar como dado */}
      <Modal open={giveModalOpen} onClose={() => setGiveModalOpen(false)} title="Marcar como já foi dado">
        <form onSubmit={handleGiveSubmit} className="flex flex-col gap-4">
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: 0 }}>
            {givingItem ? `Quem deu "${givingItem.name}"?` : ''}
          </p>
          <div>
            <label htmlFor="gift-given-by" style={labelStyle}>Nome de quem deu</label>
            <input
              id="gift-given-by"
              type="text"
              maxLength={120}
              value={givenBy}
              onChange={(e) => setGivenBy(e.target.value)}
              placeholder="Tia Marta"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setGiveModalOpen(false)}
              style={{
                background: 'transparent', color: 'var(--muted-fg)', border: 'none',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: '10px 14px',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={givingSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#5E8B6A', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 18px',
                fontWeight: 600, fontSize: '14px',
                cursor: givingSaving ? 'wait' : 'pointer', opacity: givingSaving ? 0.7 : 1,
              }}
            >
              {showGiveSpinner && <Spinner color="#fff" />} Confirmar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
