'use client'

import { useState } from 'react'
import Link from 'next/link'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { Guest, WeddingPartyEntry } from '@/types/database'

export type ConfirmedGuest = Pick<Guest, 'id' | 'name'>

export interface WeddingPartyEntryWithGuest extends WeddingPartyEntry {
  guest_name: string
}

interface WeddingPartyManagerProps {
  weddingId:       string
  initialEntries:  WeddingPartyEntryWithGuest[]
  confirmedGuests: ConfirmedGuest[]
  entryLimit:      number
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

const ROLE_SUGGESTIONS = ['Padrinho', 'Madrinha', 'Daminha', 'Pajem']

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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}
function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}
function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
function RingsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="9" cy="14" r="6" />
      <circle cx="15" cy="14" r="6" />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

const EMPTY_FORM = { guest_id: '', role: '', carries_rings: false, hasPair: false, pairSelection: '', pairRole: '' }

// "Padrinho"/"Madrinha" pareados ganham a tag "Casal de padrinhos" na linha — daminha/
// pajem (ou papéis livres fora dessa lista) só aparecem juntos na mesma linha, sem essa
// tag (não é uma tradição chamar de "casal" nesse caso).
function isPadrinhoOuMadrinha(role: string): boolean {
  const normalized = role.trim().toLowerCase()
  return normalized === 'padrinho' || normalized === 'madrinha'
}

export default function WeddingPartyManager({ weddingId, initialEntries, confirmedGuests, entryLimit }: WeddingPartyManagerProps) {
  const [entries, setEntries]           = useState<WeddingPartyEntryWithGuest[]>(initialEntries)
  const [modalOpen, setModalOpen]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [editingEntry, setEditingEntry] = useState<WeddingPartyEntryWithGuest | null>(null)
  const [editForm, setEditForm]         = useState({ role: '', carries_rings: false, hasPair: false, pairSelection: '', pairRole: '' })
  const [editSaving, setEditSaving]     = useState(false)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const showSaveSpinner                 = useDelayedLoading(saving)
  const showEditSpinner                 = useDelayedLoading(editSaving)

  const apiBase = `/api/v1/weddings/${weddingId}/wedding-party`
  const atLimit = entries.length >= entryLimit

  const assignedGuestIds = new Set(entries.map((e) => e.guest_id))
  const availableGuests  = confirmedGuests.filter((g) => !assignedGuestIds.has(g.id))

  function entryLabel(entry: WeddingPartyEntryWithGuest): string {
    return `${entry.role} — ${entry.guest_name}`
  }

  // paired_with_entry_id é guardado só de um lado, mas o par tem que aparecer nos
  // DOIS registros — sem essa busca reversa, quem foi escolhido como par nunca via
  // sua própria linha refletindo o emparelhamento.
  function pairFor(entry: WeddingPartyEntryWithGuest): WeddingPartyEntryWithGuest | undefined {
    if (entry.paired_with_entry_id) {
      const direct = entries.find((e) => e.id === entry.paired_with_entry_id)
      if (direct) return direct
    }
    return entries.find((e) => e.paired_with_entry_id === entry.id)
  }

  type PairOption =
    | { kind: 'entry'; id: string; label: string }
    | { kind: 'guest'; id: string; label: string }

  // O par pode ser (a) alguém já cadastrado no cortejo sem par ainda, ou (b) qualquer
  // outro convidado confirmado que nem entrou no cortejo ainda — nesse segundo caso o
  // par vira uma entrada nova (por isso precisa de um papel próprio, pedido à parte).
  // `excludeGuestId`/`excludeEntryId` tiram a própria pessoa/entrada sendo
  // adicionada/editada da lista, pra ninguém virar par de si mesmo.
  function pairOptions(excludeGuestId?: string, excludeEntryId?: string): PairOption[] {
    const unpairedEntries = entries.filter((entry) => {
      if (entry.id === excludeEntryId) return false
      const currentPair = pairFor(entry)
      return !currentPair || currentPair.id === excludeEntryId
    })

    const assignedGuestIdsForPair = new Set(entries.map((e) => e.guest_id))
    const unassignedGuests = confirmedGuests.filter(
      (g) => !assignedGuestIdsForPair.has(g.id) && g.id !== excludeGuestId,
    )

    return [
      ...unpairedEntries.map((entry) => ({ kind: 'entry' as const, id: entry.id, label: entryLabel(entry) })),
      ...unassignedGuests.map((guest) => ({ kind: 'guest' as const, id: guest.id, label: guest.name })),
    ]
  }

  // paired_with_entry_id não influencia sort_order sozinho — sem isso, duas pessoas
  // emparelhadas podiam aparecer com o badge de par mas longe uma da outra na lista,
  // se tivessem sido cadastradas em momentos diferentes com outras entradas no meio.
  // Sempre reposiciona `moveId` logo depois de `anchorId`, renumerando sort_order de
  // todo mundo pra não deixar buraco/duplicata.
  function buildAdjacentOrder(
    baseEntries: WeddingPartyEntryWithGuest[],
    anchorId:    string,
    moveId:      string,
  ): WeddingPartyEntryWithGuest[] {
    const moveEntry = baseEntries.find((e) => e.id === moveId)
    if (!moveEntry) return baseEntries

    const withoutMoved = baseEntries.filter((e) => e.id !== moveId)
    const anchorIdx = withoutMoved.findIndex((e) => e.id === anchorId)
    if (anchorIdx === -1) return baseEntries

    const reordered = [
      ...withoutMoved.slice(0, anchorIdx + 1),
      moveEntry,
      ...withoutMoved.slice(anchorIdx + 1),
    ]

    return reordered.map((entry, idx) => ({ ...entry, sort_order: idx }))
  }

  async function persistSortOrder(
    reordered: WeddingPartyEntryWithGuest[],
    previous:  WeddingPartyEntryWithGuest[],
  ): Promise<boolean> {
    const changed = reordered.filter((entry) => {
      const before = previous.find((e) => e.id === entry.id)
      return before && before.sort_order !== entry.sort_order
    })
    if (changed.length === 0) return true

    const results = await Promise.all(
      changed.map((entry) =>
        fetch(`${apiBase}/${entry.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sort_order: entry.sort_order }),
        }),
      ),
    )
    return results.every((r) => r.ok)
  }

  interface CortejoRow {
    primary: WeddingPartyEntryWithGuest
    partner?: WeddingPartyEntryWithGuest
  }

  // Um casal de padrinhos ocupa UMA linha só na lista (as duas pessoas juntas), não
  // duas linhas separadas — mesmo já estando adjacentes em sort_order (ver
  // buildAdjacentOrder). Percorre `entries` na ordem e "consome" o par assim que
  // encontra o primeiro dos dois, pra não desenhar a mesma dupla duas vezes.
  function buildRows(): CortejoRow[] {
    const consumed = new Set<string>()
    const rows: CortejoRow[] = []
    for (const entry of entries) {
      if (consumed.has(entry.id)) continue
      const partner = pairFor(entry)
      consumed.add(entry.id)
      if (partner) consumed.add(partner.id)
      rows.push({ primary: entry, partner })
    }
    return rows
  }

  // Move a linha inteira (1 ou 2 entradas) pra cima/baixo, trocando de lugar com a
  // linha vizinha — reaproveita o mesmo mecanismo de sort_order sequencial de
  // buildAdjacentOrder/persistSortOrder, só que baseado em linhas, não em entradas soltas.
  async function handleMoveRow(rowIdx: number, direction: 'up' | 'down') {
    const rows = buildRows()
    const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1
    if (targetIdx < 0 || targetIdx >= rows.length) return

    const current = rows[rowIdx]
    const target  = rows[targetIdx]
    if (!current || !target) return

    const reorderedRows = [...rows]
    reorderedRows[rowIdx]    = target
    reorderedRows[targetIdx] = current

    const flatEntries = reorderedRows.flatMap((row) => (row.partner ? [row.primary, row.partner] : [row.primary]))
    const withNewSortOrders = flatEntries.map((entry, idx) => ({ ...entry, sort_order: idx }))

    const previous = entries
    setEntries(withNewSortOrders)
    const ok = await persistSortOrder(withNewSortOrders, previous)
    if (!ok) {
      setEntries(previous)
      toastError('Não foi possível reordenar o cortejo.')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !form.guest_id) return

    if (form.hasPair && !form.pairSelection) {
      toastError('Escolha com quem essa pessoa vai entrar.')
      return
    }
    const pairsNewGuest = form.hasPair && form.pairSelection.startsWith('guest:')
    if (pairsNewGuest && !form.pairRole.trim()) {
      toastError('Informe o papel do par no cortejo.')
      return
    }

    setSaving(true)

    const pairEntryId = form.hasPair && form.pairSelection.startsWith('entry:')
      ? form.pairSelection.slice('entry:'.length)
      : null

    const res = await fetch(apiBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_id:              form.guest_id,
        role:                  form.role.trim(),
        carries_rings:         form.carries_rings,
        paired_with_entry_id:  pairEntryId,
      }),
    })

    if (!res.ok) {
      setSaving(false)
      toastError(await readApiError(res, 'Não foi possível adicionar ao cortejo.'))
      return
    }

    const { data } = (await res.json()) as { data: WeddingPartyEntry }
    const guest = confirmedGuests.find((g) => g.id === data.guest_id)
    const primaryWithGuest = { ...data, guest_name: guest?.name ?? '' }

    // Par escolhido ainda não está no cortejo: cria a entrada dele agora, já apontando
    // pra entrada recém-criada acima. Se essa segunda chamada falhar, desfaz a
    // primeira — senão a pessoa ficaria sozinha no cortejo sem o par que o casal pediu.
    if (pairsNewGuest) {
      const pairGuestId = form.pairSelection.slice('guest:'.length)
      const pairRes = await fetch(apiBase, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id:             pairGuestId,
          role:                 form.pairRole.trim(),
          carries_rings:        false,
          paired_with_entry_id: data.id,
        }),
      })

      if (!pairRes.ok) {
        await fetch(`${apiBase}/${data.id}`, { method: 'DELETE' })
        setSaving(false)
        toastError(await readApiError(pairRes, 'Não foi possível adicionar o par ao cortejo.'))
        return
      }

      const { data: pairData } = (await pairRes.json()) as { data: WeddingPartyEntry }
      const pairGuest = confirmedGuests.find((g) => g.id === pairData.guest_id)
      setEntries((prev) => [...prev, primaryWithGuest, { ...pairData, guest_name: pairGuest?.name ?? '' }])
    } else if (pairEntryId) {
      // Par já cadastrado, possivelmente longe na lista — reposiciona a entrada nova
      // logo ao lado dele.
      const nextEntries = [...entries, primaryWithGuest]
      const reordered = buildAdjacentOrder(nextEntries, pairEntryId, primaryWithGuest.id)
      setEntries(reordered)
      const ok = await persistSortOrder(reordered, nextEntries)
      if (!ok) toastError('Entrada adicionada, mas não foi possível reordenar o cortejo — arraste manualmente se precisar.')
    } else {
      setEntries((prev) => [...prev, primaryWithGuest])
    }

    setSaving(false)
    setForm(EMPTY_FORM)
    setModalOpen(false)
    toastSuccess('Entrada adicionada ao cortejo.')
  }

  function openEditModal(entry: WeddingPartyEntryWithGuest) {
    // pairFor() olha nos dois sentidos — se ALGUÉM aponta pra essa entrada (em vez do
    // contrário), o campo "Entra com" precisa mostrar isso mesmo que o FK desta
    // entrada esteja vazio.
    const pair = pairFor(entry)
    setEditForm({
      role:          entry.role,
      carries_rings: entry.carries_rings,
      hasPair:       Boolean(pair),
      pairSelection: pair ? `entry:${pair.id}` : '',
      pairRole:      '',
    })
    setEditingEntry(entry)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEntry || editSaving) return

    if (editForm.hasPair && !editForm.pairSelection) {
      toastError('Escolha com quem essa pessoa vai entrar.')
      return
    }
    const pairsNewGuest = editForm.hasPair && editForm.pairSelection.startsWith('guest:')
    if (pairsNewGuest && !editForm.pairRole.trim()) {
      toastError('Informe o papel do par no cortejo.')
      return
    }

    setEditSaving(true)

    const pairEntryId = editForm.hasPair && editForm.pairSelection.startsWith('entry:')
      ? editForm.pairSelection.slice('entry:'.length)
      : null

    const res = await fetch(`${apiBase}/${editingEntry.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role:                 editForm.role.trim(),
        carries_rings:        editForm.carries_rings,
        paired_with_entry_id: pairEntryId,
      }),
    })

    if (!res.ok) {
      setEditSaving(false)
      toastError(await readApiError(res, 'Não foi possível atualizar a entrada.'))
      return
    }

    const { data } = (await res.json()) as { data: WeddingPartyEntry }
    const updatedEntry = {
      ...editingEntry,
      role: data.role, carries_rings: data.carries_rings, paired_with_entry_id: data.paired_with_entry_id,
    }

    // Par escolhido ainda não está no cortejo: cria a entrada dele agora, apontando pra
    // esta entrada já editada acima (não precisa mexer no FK desta entrada — pairFor()
    // já encontra o par pelo sentido inverso).
    if (pairsNewGuest) {
      const pairGuestId = editForm.pairSelection.slice('guest:'.length)
      const pairRes = await fetch(apiBase, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id:             pairGuestId,
          role:                 editForm.pairRole.trim(),
          carries_rings:        false,
          paired_with_entry_id: editingEntry.id,
        }),
      })

      if (!pairRes.ok) {
        setEditSaving(false)
        toastError(await readApiError(pairRes, 'Não foi possível adicionar o par ao cortejo.'))
        return
      }

      const { data: pairData } = (await pairRes.json()) as { data: WeddingPartyEntry }
      const pairGuest = confirmedGuests.find((g) => g.id === pairData.guest_id)
      const pairEntryWithGuest = { ...pairData, guest_name: pairGuest?.name ?? '' }
      const nextEntries = [
        ...entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)),
        pairEntryWithGuest,
      ]
      const reordered = buildAdjacentOrder(nextEntries, updatedEntry.id, pairEntryWithGuest.id)
      setEntries(reordered)
      const ok = await persistSortOrder(reordered, nextEntries)
      if (!ok) toastError('Par adicionado, mas não foi possível reordenar o cortejo — arraste manualmente se precisar.')
    } else if (pairEntryId) {
      // Par já cadastrado, possivelmente longe na lista — reposiciona esta entrada
      // logo ao lado dele.
      const nextEntries = entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
      const reordered = buildAdjacentOrder(nextEntries, pairEntryId, updatedEntry.id)
      setEntries(reordered)
      const ok = await persistSortOrder(reordered, nextEntries)
      if (!ok) toastError('Entrada atualizada, mas não foi possível reordenar o cortejo — arraste manualmente se precisar.')
    } else {
      setEntries((prev) => prev.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)))
    }

    setEditSaving(false)
    setEditingEntry(null)
    toastSuccess('Entrada atualizada com sucesso.')
  }

  async function handleDelete(entry: WeddingPartyEntryWithGuest) {
    if (deletingId) return
    if (!window.confirm(`Remover ${entry.guest_name} do cortejo?`)) return

    setDeletingId(entry.id)
    const res = await fetch(`${apiBase}/${entry.id}`, { method: 'DELETE' })
    setDeletingId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover a entrada.'))
      return
    }

    setEntries((prev) =>
      prev
        .filter((e) => e.id !== entry.id)
        .map((e) => (e.paired_with_entry_id === entry.id ? { ...e, paired_with_entry_id: null } : e)),
    )
    toastSuccess('Entrada removida do cortejo.')
  }

  // Uma pessoa dentro de uma linha do cortejo (sozinha ou parte de um casal de
  // padrinhos) — edição/exclusão continuam por pessoa, só o mover pra cima/baixo é da
  // linha inteira (ver handleMoveRow).
  function renderPersonLine(entry: WeddingPartyEntryWithGuest, isLast: boolean) {
    return (
      <div className="flex items-center gap-3" style={{ marginBottom: isLast ? 0 : '6px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>
            {entry.role} <span style={{ fontWeight: 400, color: 'var(--muted-fg)' }}>· {entry.guest_name}</span>
          </span>
          {entry.carries_rings && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px',
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '99px', background: '#E9EFE6', color: '#5E8B6A',
              }}
            >
              <RingsIcon /> Leva as alianças
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => openEditModal(entry)}
          aria-label={`Editar entrada de ${entry.guest_name}`}
          title="Editar entrada"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '8px', flexShrink: 0,
            border: 'none', background: 'transparent', color: 'var(--muted-fg)',
            cursor: 'pointer', padding: 0,
          }}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          onClick={() => handleDelete(entry)}
          disabled={deletingId === entry.id}
          aria-label={`Remover ${entry.guest_name} do cortejo`}
          title="Remover do cortejo"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '8px', flexShrink: 0,
            border: 'none', background: 'transparent', color: '#C0553F',
            cursor: deletingId === entry.id ? 'wait' : 'pointer',
            opacity: deletingId === entry.id ? 0.5 : 1, padding: 0,
          }}
        >
          <TrashIcon />
        </button>
      </div>
    )
  }

  const cortejoRows = buildRows()

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Padrinhos &amp; Entradas
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Monte o cortejo com quem já confirmou presença · {entries.length}/{entryLimit} entradas adicionais do plano
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={atLimit || availableGuests.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px',
            cursor: atLimit || availableGuests.length === 0 ? 'not-allowed' : 'pointer',
            opacity: atLimit || availableGuests.length === 0 ? 0.5 : 1,
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Adicionar ao cortejo
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
            Você atingiu o limite de {entryLimit} entradas adicionais do seu plano.
          </span>
          <Link
            href="/perfil/planos"
            style={{ fontWeight: 700, color: '#9A7020', textDecoration: 'underline' }}
          >
            Fazer upgrade para adicionar mais pessoas ao cortejo
          </Link>
        </div>
      )}
      {!atLimit && availableGuests.length === 0 && confirmedGuests.length === 0 && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{
            background: 'var(--wedding-color-subtle)', border: '1px solid #EBDDD0',
            fontSize: '14px', color: 'var(--muted-fg)',
          }}
        >
          Nenhum convidado confirmado ainda. Confirme presenças na aba Convidados para poder montar o cortejo.
        </div>
      )}

      {/* Lista do cortejo */}
      <div className="overflow-hidden rounded-2xl bg-[var(--surface)]" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {/* Entrada dos noivos — sempre a primeira, informativa */}
        <div
          className="flex flex-wrap items-center gap-4 px-5 py-4"
          style={{ borderBottom: '1px solid #F8F3EE', background: 'var(--wedding-color-subtle)' }}
        >
          <div
            style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--wedding-color)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '13px',
            }}
          >
            1
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)' }}>
              Entrada dos noivos
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
              Sempre a entrada final do cortejo — não precisa ser cadastrada.
            </div>
          </div>
        </div>

        {cortejoRows.map((row, idx) => {
          const showCasalTag = Boolean(
            row.partner && isPadrinhoOuMadrinha(row.primary.role) && isPadrinhoOuMadrinha(row.partner.role),
          )
          return (
            <div
              key={row.primary.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
              style={{ borderBottom: idx < cortejoRows.length - 1 ? '1px solid #F8F3EE' : 'none' }}
            >
              <div
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--wedding-color) 14%, transparent)', color: 'var(--wedding-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '13px', alignSelf: 'flex-start',
                }}
              >
                {idx + 2}
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                {renderPersonLine(row.primary, !row.partner)}
                {row.partner && renderPersonLine(row.partner, true)}
                {showCasalTag && (
                  <span
                    style={{
                      display: 'inline-flex', marginTop: '6px',
                      fontSize: '11.5px', fontWeight: 600, padding: '3px 9px',
                      borderRadius: '99px', background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
                    }}
                  >
                    Casal de padrinhos
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, alignSelf: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => handleMoveRow(idx, 'up')}
                  disabled={idx === 0}
                  aria-label="Mover para cima"
                  title="Mover para cima"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '26px', height: '26px', borderRadius: '8px',
                    border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                    cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.35 : 1, padding: 0,
                  }}
                >
                  <ArrowUpIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveRow(idx, 'down')}
                  disabled={idx === cortejoRows.length - 1}
                  aria-label="Mover para baixo"
                  title="Mover para baixo"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '26px', height: '26px', borderRadius: '8px',
                    border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                    cursor: idx === cortejoRows.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: idx === cortejoRows.length - 1 ? 0.35 : 1, padding: 0,
                  }}
                >
                  <ArrowDownIcon />
                </button>
              </div>
            </div>
          )
        })}
        {cortejoRows.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            Nenhuma outra entrada adicionada ainda.
          </div>
        )}
      </div>

      {/* Modal de nova entrada */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Adicionar ao cortejo">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label htmlFor="party-guest" style={labelStyle}>Convidado *</label>
            <select
              id="party-guest"
              required
              value={form.guest_id}
              onChange={(e) => setForm((f) => ({ ...f, guest_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Selecione um convidado confirmado…</option>
              {availableGuests.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="party-role" style={labelStyle}>Papel no cortejo *</label>
            <input
              id="party-role"
              type="text"
              required
              maxLength={60}
              list="party-role-suggestions"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Padrinho, Madrinha, Daminha, Pajem…"
              style={inputStyle}
            />
            <datalist id="party-role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.carries_rings}
              onChange={(e) => setForm((f) => ({ ...f, carries_rings: e.target.checked }))}
            />
            Leva as alianças
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.hasPair}
              onChange={(e) => setForm((f) => ({ ...f, hasPair: e.target.checked, pairSelection: e.target.checked ? f.pairSelection : '', pairRole: e.target.checked ? f.pairRole : '' }))}
            />
            Vai entrar com alguém?
          </label>
          {form.hasPair && (
            <>
              <div>
                <label htmlFor="party-pair" style={labelStyle}>Entra com</label>
                <select
                  id="party-pair"
                  value={form.pairSelection}
                  onChange={(e) => setForm((f) => ({ ...f, pairSelection: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Selecione quem já confirmou…</option>
                  {pairOptions(form.guest_id).map((opt) => (
                    <option key={`${opt.kind}:${opt.id}`} value={`${opt.kind}:${opt.id}`}>
                      {opt.kind === 'entry' ? opt.label : `${opt.label} (ainda não no cortejo)`}
                    </option>
                  ))}
                </select>
              </div>
              {form.pairSelection.startsWith('guest:') && (
                <div>
                  <label htmlFor="party-pair-role" style={labelStyle}>Papel do par no cortejo *</label>
                  <input
                    id="party-pair-role"
                    type="text"
                    required
                    maxLength={60}
                    list="party-role-suggestions"
                    value={form.pairRole}
                    onChange={(e) => setForm((f) => ({ ...f, pairRole: e.target.value }))}
                    placeholder="Padrinho, Madrinha, Daminha, Pajem…"
                    style={inputStyle}
                  />
                </div>
              )}
            </>
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

      {/* Modal de edição de entrada */}
      <Modal open={editingEntry !== null} onClose={() => setEditingEntry(null)} title="Editar entrada">
        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-party-role" style={labelStyle}>Papel no cortejo *</label>
            <input
              id="edit-party-role"
              type="text"
              required
              maxLength={60}
              list="party-role-suggestions"
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={editForm.carries_rings}
              onChange={(e) => setEditForm((f) => ({ ...f, carries_rings: e.target.checked }))}
            />
            Leva as alianças
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={editForm.hasPair}
              onChange={(e) => setEditForm((f) => ({ ...f, hasPair: e.target.checked, pairSelection: e.target.checked ? f.pairSelection : '', pairRole: e.target.checked ? f.pairRole : '' }))}
            />
            Vai entrar com alguém?
          </label>
          {editForm.hasPair && (
            <>
              <div>
                <label htmlFor="edit-party-pair" style={labelStyle}>Entra com</label>
                <select
                  id="edit-party-pair"
                  value={editForm.pairSelection}
                  onChange={(e) => setEditForm((f) => ({ ...f, pairSelection: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Selecione quem já confirmou…</option>
                  {pairOptions(editingEntry?.guest_id, editingEntry?.id).map((opt) => (
                    <option key={`${opt.kind}:${opt.id}`} value={`${opt.kind}:${opt.id}`}>
                      {opt.kind === 'entry' ? opt.label : `${opt.label} (ainda não no cortejo)`}
                    </option>
                  ))}
                </select>
              </div>
              {editForm.pairSelection.startsWith('guest:') && (
                <div>
                  <label htmlFor="edit-party-pair-role" style={labelStyle}>Papel do par no cortejo *</label>
                  <input
                    id="edit-party-pair-role"
                    type="text"
                    required
                    maxLength={60}
                    list="party-role-suggestions"
                    value={editForm.pairRole}
                    onChange={(e) => setEditForm((f) => ({ ...f, pairRole: e.target.value }))}
                    placeholder="Padrinho, Madrinha, Daminha, Pajem…"
                    style={inputStyle}
                  />
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setEditingEntry(null)}
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
