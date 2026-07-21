'use client'

import { useRef, useState } from 'react'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { buildRsvpWhatsAppUrl } from '@/lib/rsvp/build-whatsapp-link'
import type { Guest, GuestStatus } from '@/types/database'

type Filter = 'todos' | GuestStatus

interface GuestsManagerProps {
  weddingId:           string
  initialGuests:       Guest[]
  guestLimit:          number
  rsvpMessageTemplate: string | null
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

const STATUS_STYLE: Record<GuestStatus, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmado', color: '#5E8B6A', bg: '#E9EFE6' },
  pendente:   { label: 'Pendente',   color: 'var(--wedding-color-dark)', bg: 'var(--wedding-color-subtle)' },
  recusado:   { label: 'Recusado',   color: '#C0553F', bg: '#F6E4DE' },
}

const FILTER_OPTS: { key: Filter; label: string }[] = [
  { key: 'todos',      label: 'Todos' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'pendente',   label: 'Pendentes' },
  { key: 'recusado',   label: 'Recusados' },
]

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.763.462 3.486 1.34 5.003l-1.42 5.187 5.31-1.393a9.96 9.96 0 0 0 4.767 1.213h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.671-1.04-5.182-2.929-7.071a9.935 9.935 0 0 0-7.072-2.939zm0 18.183h-.003a8.18 8.18 0 0 1-4.166-1.14l-.299-.177-3.15.826.841-3.07-.194-.316a8.186 8.186 0 0 1-1.256-4.393c0-4.529 3.685-8.213 8.23-8.213 2.198 0 4.264.857 5.818 2.413a8.161 8.161 0 0 1 2.408 5.812c0 4.529-3.685 8.213-8.23 8.213z" />
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

export default function GuestsManager({ weddingId, initialGuests, guestLimit, rsvpMessageTemplate }: GuestsManagerProps) {
  const [guests, setGuests]       = useState<Guest[]>(initialGuests)
  const [filter, setFilter]       = useState<Filter>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError]         = useState('')
  const [formError, setFormError] = useState('')
  const [form, setForm]           = useState({ name: '', email: '', phone: '', group_name: '' })
  const fileInputRef              = useRef<HTMLInputElement>(null)
  const showSaveSpinner           = useDelayedLoading(saving)
  const showImportSpinner         = useDelayedLoading(importing)

  const apiBase = `/api/v1/weddings/${weddingId}/guests`
  const atLimit = guests.length >= guestLimit

  const stats = {
    total:      guests.length,
    confirmado: guests.filter((g) => g.status === 'confirmado').length,
    pendente:   guests.filter((g) => g.status === 'pendente').length,
    recusado:   guests.filter((g) => g.status === 'recusado').length,
  }

  const visible = guests.filter((g) => filter === 'todos' || g.status === filter)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')

    const res = await fetch(apiBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:       form.name.trim(),
        email:      form.email.trim() || null,
        phone:      form.phone.trim() || null,
        group_name: form.group_name.trim() || null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      setFormError(await readApiError(res, 'Não foi possível adicionar o convidado.'))
      return
    }

    const { data } = (await res.json()) as { data: Guest }
    setGuests((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    setForm({ name: '', email: '', phone: '', group_name: '' })
    setModalOpen(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || importing) return

    setImporting(true)
    setError('')

    const csv = await file.text()
    const res = await fetch(`${apiBase}/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'text/csv' },
      body:    csv,
    })

    setImporting(false)
    if (!res.ok) {
      setError(await readApiError(res, 'Não foi possível importar o CSV.'))
      return
    }

    const { data } = (await res.json()) as { data: Guest[] }
    setGuests((prev) => [...prev, ...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
  }

  async function handleStatusChange(guest: Guest, status: GuestStatus) {
    const previous = guests
    setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, status } : g)))
    setError('')

    const res = await fetch(`${apiBase}/${guest.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })

    if (!res.ok) {
      setGuests(previous)
      setError(await readApiError(res, 'Não foi possível atualizar o status.'))
    }
  }

  function handleSendWhatsApp(guest: Guest) {
    const rsvpLink = `${window.location.origin}/rsvp/${guest.rsvp_token}`
    const url = buildRsvpWhatsAppUrl({
      guestName:       guest.name,
      guestPhone:      guest.phone,
      rsvpLink,
      messageTemplate: rsvpMessageTemplate,
    })
    window.open(url, '_blank')
  }

  async function handleDelete(guest: Guest) {
    if (!window.confirm(`Remover ${guest.name} da lista de convidados?`)) return

    const previous = guests
    setGuests((prev) => prev.filter((g) => g.id !== guest.id))
    setError('')

    const res = await fetch(`${apiBase}/${guest.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setGuests(previous)
      setError(await readApiError(res, 'Não foi possível remover o convidado.'))
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
            Convidados
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Gerencie sua lista de convidados e confirmações · {guests.length}/{guestLimit} do plano
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={atLimit || importing}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'transparent', color: 'var(--wedding-color)',
              border: '1.5px solid var(--wedding-color)', borderRadius: '12px',
              padding: '10px 16px', fontWeight: 600, fontSize: '14px',
              cursor: atLimit || importing ? 'not-allowed' : 'pointer',
              opacity: atLimit || importing ? 0.5 : 1,
            }}
          >
            {showImportSpinner ? <Spinner /> : <UploadIcon />} Importar CSV
          </button>
          <button
            onClick={() => { setFormError(''); setModalOpen(true) }}
            disabled={atLimit}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 16px',
              fontWeight: 600, fontSize: '14px',
              cursor: atLimit ? 'not-allowed' : 'pointer',
              opacity: atLimit ? 0.5 : 1,
              boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
            }}
          >
            <PlusIcon /> Convidado
          </button>
        </div>
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
            Você atingiu o limite de {guestLimit} convidados do seu plano.
          </span>
          <a
            href="/perfil/planos"
            style={{ fontWeight: 700, color: '#9A7020', textDecoration: 'underline' }}
          >
            Fazer upgrade para convidar mais pessoas
          </a>
        </div>
      )}

      {error && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: '#F6E4DE', border: '1px solid #C0553F', fontSize: '14px', color: '#C0553F' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
        {[
          { label: 'Total',       value: stats.total,      color: 'var(--fg)' },
          { label: 'Confirmados', value: stats.confirmado, color: '#5E8B6A' },
          { label: 'Pendentes',   value: stats.pendente,   color: 'var(--wedding-color-dark)' },
          { label: 'Recusados',   value: stats.recusado,   color: '#C0553F' },
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

      {/* Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_OPTS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '7px 16px', borderRadius: '99px', fontSize: '13.5px',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f.key ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
              color: filter === f.key ? '#fff' : '#9A7A60',
              transition: 'all 0.18s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Guest list */}
      <div className="overflow-hidden rounded-2xl bg-[var(--surface)]" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {visible.map((guest, idx) => {
          const st = STATUS_STYLE[guest.status]
          const initial = guest.name.charAt(0).toUpperCase()
          const details = [guest.group_name, guest.email, guest.phone].filter(Boolean).join(' · ')
          return (
            <div
              key={guest.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
              style={{ borderBottom: idx < visible.length - 1 ? '1px solid #F8F3EE' : 'none' }}
            >
              <div
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--wedding-color) 14%, transparent)', color: 'var(--wedding-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '16px',
                }}
              >
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>
                  {guest.name}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
                  {details || 'Sem detalhes'}
                </div>
              </div>
              <select
                value={guest.status}
                onChange={(e) => handleStatusChange(guest, e.target.value as GuestStatus)}
                aria-label={`Status de ${guest.name}`}
                style={{
                  fontSize: '12px', fontWeight: 600, padding: '5px 10px',
                  borderRadius: '99px', background: st.bg, color: st.color,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="recusado">Recusado</option>
              </select>
              <button
                onClick={() => handleSendWhatsApp(guest)}
                title={`Enviar link de confirmação para ${guest.name} pelo WhatsApp`}
                aria-label={`Enviar link de confirmação para ${guest.name} pelo WhatsApp`}
                style={{
                  border: 'none', background: 'transparent', color: '#5E8B6A',
                  cursor: 'pointer', padding: '6px', borderRadius: '8px', flexShrink: 0,
                }}
              >
                <WhatsAppIcon />
              </button>
              <button
                onClick={() => handleDelete(guest)}
                title={`Remover ${guest.name}`}
                aria-label={`Remover ${guest.name}`}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                  cursor: 'pointer', padding: '6px', borderRadius: '8px', flexShrink: 0,
                }}
              >
                <TrashIcon />
              </button>
            </div>
          )
        })}
        {visible.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            {guests.length === 0
              ? 'Nenhum convidado ainda. Adicione o primeiro ou importe um CSV (nome,email,grupo).'
              : 'Nenhum convidado encontrado para este filtro.'}
          </div>
        )}
      </div>

      {/* Modal de novo convidado */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo convidado">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label htmlFor="guest-name" style={labelStyle}>Nome *</label>
            <input
              id="guest-name"
              type="text"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Maria Silva"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="guest-email" style={labelStyle}>E-mail</label>
            <input
              id="guest-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="maria@email.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="guest-phone" style={labelStyle}>Telefone</label>
            <input
              id="guest-phone"
              type="tel"
              minLength={5}
              maxLength={30}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(11) 99999-9999"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="guest-group" style={labelStyle}>Grupo</label>
            <input
              id="guest-group"
              type="text"
              maxLength={80}
              value={form.group_name}
              onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
              placeholder="Família da noiva, Amigos do trabalho…"
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
              {showSaveSpinner && <Spinner color="#fff" />} Adicionar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
