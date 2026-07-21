'use client'

import { useRef, useState } from 'react'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import type { Guest, TableConfig } from '@/types/database'

export type TableGuest = Pick<Guest, 'id' | 'name' | 'group_name'>

export interface TableWithGuests extends TableConfig {
  guests: TableGuest[]
}

interface TablesBoardProps {
  weddingId:     string
  initialTables: TableWithGuests[]
  allGuests:     TableGuest[]
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface DragInfo {
  guestId: string
  source:  string
}

const UNASSIGNED = 'unassigned'

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function MoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </svg>
  )
}

interface MoveDestination {
  id:       string
  label:    string
  count:    number
  capacity: number
}

function GuestChip({ name, title, draggable = true, onDragStart, guestId, currentLocation, destinations, onMove }: {
  name: string
  title?: string
  draggable?: boolean
  onDragStart?: () => void
  guestId: string
  currentLocation: string
  destinations: MoveDestination[]
  onMove: (guestId: string, source: string, target: string) => void
}) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '99px',
        background: 'var(--wedding-color-subtle)', border: '1px solid #EBDDD0',
        fontSize: '12.5px', fontWeight: 500, color: 'var(--fg)',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%',
        background: 'color-mix(in srgb, var(--wedding-color) 18%, transparent)', color: 'var(--wedding-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700, flexShrink: 0,
      }}>
        {initial}
      </div>
      {name}
      <span
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
          color: 'var(--muted-fg)', background: 'var(--surface)',
        }}
      >
        <MoveIcon />
        <select
          aria-label={`Mover ${name} de mesa`}
          value={currentLocation}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const target = e.target.value
            if (target !== currentLocation) onMove(guestId, currentLocation, target)
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', border: 'none', appearance: 'none',
          }}
        >
          <option value={UNASSIGNED}>Sem mesa</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id !== currentLocation && d.count >= d.capacity}>
              {d.label} ({d.count}/{d.capacity})
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

export default function TablesBoard({ weddingId, initialTables, allGuests }: TablesBoardProps) {
  const [tables, setTables]             = useState<TableWithGuests[]>(initialTables)
  const [modalOpen, setModalOpen]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm]                 = useState({ label: '', capacity: '8' })
  const [editingTable, setEditingTable] = useState<TableWithGuests | null>(null)
  const [editForm, setEditForm]         = useState({ label: '', capacity: '8' })
  const [editSaving, setEditSaving]     = useState(false)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const dragging                        = useRef<DragInfo | null>(null)
  const showSaveSpinner                 = useDelayedLoading(saving)
  const showEditSpinner                 = useDelayedLoading(editSaving)

  const apiBase = `/api/v1/weddings/${weddingId}/tables`

  const assignedIds = new Set(tables.flatMap((t) => t.guests.map((g) => g.id)))
  const unassigned  = allGuests.filter((g) => !assignedIds.has(g.id))
  const destinations: MoveDestination[] = tables.map((t) => ({
    id: t.id, label: t.label, count: t.guests.length, capacity: t.capacity,
  }))

  const totalGuests = tables.reduce((sum, t) => sum + t.guests.length, 0)
  const totalCap    = tables.reduce((sum, t) => sum + t.capacity, 0)

  function handleDragStart(guestId: string, source: string) {
    dragging.current = { guestId, source }
  }

  async function resyncTables(fallback: TableWithGuests[]) {
    try {
      const res = await fetch(apiBase)
      if (!res.ok) {
        setTables(fallback)
        return
      }
      const { data } = (await res.json()) as { data: TableWithGuests[] }
      setTables(data)
    } catch {
      setTables(fallback)
    }
  }

  async function moveGuest(guestId: string, source: string, target: string) {
    if (source === target) return

    const guest = allGuests.find((g) => g.id === guestId)
    if (!guest) return

    // Evita chamada desnecessária quando já sabemos que a mesa de destino está cheia
    if (target !== UNASSIGNED) {
      const destination = tables.find((t) => t.id === target)
      if (destination && destination.guests.length >= destination.capacity) {
        toastError('Esta mesa já atingiu a capacidade máxima.')
        return
      }
    }

    const previous = tables
    setTables((prev) => {
      const next = prev.map((t) => ({ ...t, guests: [...t.guests] }))
      if (source !== UNASSIGNED) {
        const src = next.find((t) => t.id === source)
        if (src) src.guests = src.guests.filter((g) => g.id !== guestId)
      }
      if (target !== UNASSIGNED) {
        const dst = next.find((t) => t.id === target)
        if (dst) dst.guests.push(guest)
      }
      return next
    })

    try {
      if (source !== UNASSIGNED) {
        const res = await fetch(`${apiBase}/${source}/assign/${guestId}`, { method: 'DELETE' })
        if (!res.ok) {
          setTables(previous)
          toastError(await readApiError(res, 'Não foi possível mover o convidado.'))
          return
        }
      }

      if (target !== UNASSIGNED) {
        const res = await fetch(`${apiBase}/${target}/assign`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ guest_id: guestId }),
        })
        if (!res.ok) {
          toastError(await readApiError(res, 'Não foi possível alocar o convidado nesta mesa.'))
          await resyncTables(previous)
          return
        }
      }
    } catch {
      toastError('Erro de conexão com o servidor. Tente novamente.')
      await resyncTables(previous)
    }
  }

  async function handleDrop(target: string) {
    const info = dragging.current
    dragging.current = null
    if (!info) return
    await moveGuest(info.guestId, info.source, target)
  }

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    const res = await fetch(apiBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label:    form.label.trim(),
        capacity: Number(form.capacity),
      }),
    })

    setSaving(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar a mesa.'))
      return
    }

    const { data } = (await res.json()) as { data: TableConfig }
    setTables((prev) => [...prev, { ...data, guests: [] }])
    setForm({ label: '', capacity: '8' })
    setModalOpen(false)
  }

  function openEditModal(table: TableWithGuests) {
    setEditForm({ label: table.label, capacity: String(table.capacity) })
    setEditingTable(table)
  }

  async function handleUpdateTable(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTable || editSaving) return
    setEditSaving(true)

    const res = await fetch(`${apiBase}/${editingTable.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label:    editForm.label.trim(),
        capacity: Number(editForm.capacity),
      }),
    })

    setEditSaving(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível atualizar a mesa.'))
      return
    }

    const { data } = (await res.json()) as { data: TableConfig }
    setTables((prev) =>
      prev.map((t) => (t.id === data.id ? { ...t, label: data.label, capacity: data.capacity } : t)),
    )
    setEditingTable(null)
  }

  async function handleDeleteTable(table: TableWithGuests) {
    if (deletingId) return
    const confirmed = window.confirm(`Excluir a mesa "${table.label}"? Os convidados voltam para "sem mesa".`)
    if (!confirmed) return

    setDeletingId(table.id)

    const res = await fetch(`${apiBase}/${table.id}`, { method: 'DELETE' })

    setDeletingId(null)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível excluir a mesa.'))
      return
    }

    setTables((prev) => prev.filter((t) => t.id !== table.id))
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
            Organização das mesas
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Arraste os convidados para as mesas · {totalGuests}/{totalCap} lugares preenchidos
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Nova mesa
        </button>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Unassigned */}
        <div>
          <div
            style={{
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--muted-fg)', marginBottom: '10px',
            }}
          >
            Sem mesa ({unassigned.length})
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(UNASSIGNED)}
            style={{
              minHeight: '220px', borderRadius: '18px', padding: '14px',
              border: '2px dashed #EBDDD0', background: 'var(--wedding-color-subtle)',
              display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start',
            }}
          >
            {unassigned.map((guest) => (
              <GuestChip
                key={guest.id}
                name={guest.name}
                title={guest.group_name ?? undefined}
                onDragStart={() => handleDragStart(guest.id, UNASSIGNED)}
                guestId={guest.id}
                currentLocation={UNASSIGNED}
                destinations={destinations}
                onMove={moveGuest}
              />
            ))}
            {unassigned.length === 0 && (
              <span style={{ fontSize: '13px', color: '#C8B4A0', padding: '8px 4px' }}>
                Todos alocados!
              </span>
            )}
          </div>
        </div>

        {/* Tables grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))' }}>
          {tables.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1', borderRadius: '18px', padding: '40px',
                border: '2px dashed #EBDDD0', background: 'var(--wedding-color-subtle)',
                textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px',
              }}
            >
              Nenhuma mesa criada ainda.
            </div>
          )}
          {tables.map((table) => {
            const full = table.guests.length >= table.capacity
            return (
              <div
                key={table.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(table.id)}
                style={{
                  borderRadius: '18px', background: 'var(--surface)',
                  border: '2px dashed #EBDDD0',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(60,40,24,0.06)',
                  minHeight: '130px',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F0E8DE',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {table.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '12px', fontWeight: 700, padding: '2px 9px',
                        borderRadius: '99px',
                        background: full ? '#F6E4DE' : 'var(--wedding-color-subtle)',
                        color: full ? '#C0553F' : 'var(--wedding-color-dark)',
                      }}
                    >
                      {table.guests.length}/{table.capacity}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(table)}
                      aria-label={`Editar ${table.label}`}
                      title="Editar mesa"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: '8px',
                        border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTable(table)}
                      disabled={deletingId === table.id}
                      aria-label={`Excluir ${table.label}`}
                      title="Excluir mesa"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: '8px',
                        border: 'none', background: 'transparent', color: '#C0553F',
                        cursor: deletingId === table.id ? 'wait' : 'pointer', padding: 0,
                        opacity: deletingId === table.id ? 0.5 : 1,
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {/* Guests */}
                <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '64px' }}>
                  {table.guests.map((guest) => (
                    <GuestChip
                      key={guest.id}
                      name={guest.name}
                      title={guest.group_name ?? undefined}
                      onDragStart={() => handleDragStart(guest.id, table.id)}
                      guestId={guest.id}
                      currentLocation={table.id}
                      destinations={destinations}
                      onMove={moveGuest}
                    />
                  ))}
                  {table.guests.length === 0 && (
                    <span style={{ fontSize: '12.5px', color: '#C8B4A0' }}>
                      Solte aqui
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de nova mesa */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova mesa">
        <form onSubmit={handleCreateTable} className="flex flex-col gap-4">
          <div>
            <label htmlFor="table-label" style={labelStyle}>Nome da mesa *</label>
            <input
              id="table-label"
              type="text"
              required
              maxLength={80}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Mesa 1, Família da noiva…"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="table-capacity" style={labelStyle}>Capacidade *</label>
            <input
              id="table-capacity"
              type="number"
              required
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
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
              {showSaveSpinner && <Spinner color="#fff" />} Criar mesa
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de edição de mesa */}
      <Modal open={editingTable !== null} onClose={() => setEditingTable(null)} title="Editar mesa">
        <form onSubmit={handleUpdateTable} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-table-label" style={labelStyle}>Nome da mesa *</label>
            <input
              id="edit-table-label"
              type="text"
              required
              maxLength={80}
              value={editForm.label}
              onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="edit-table-capacity" style={labelStyle}>Capacidade *</label>
            <input
              id="edit-table-capacity"
              type="number"
              required
              min={1}
              max={100}
              value={editForm.capacity}
              onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setEditingTable(null)}
              style={{
                background: 'transparent', color: 'var(--muted-fg)', border: 'none',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: '10px 14px',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 18px',
                fontWeight: 600, fontSize: '14px',
                cursor: editSaving ? 'wait' : 'pointer', opacity: editSaving ? 0.7 : 1,
              }}
            >
              {showEditSpinner && <Spinner color="#fff" />} Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
