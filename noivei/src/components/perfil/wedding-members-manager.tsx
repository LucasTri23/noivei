'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { WeddingInvite, WeddingMemberRole } from '@/types/database'

interface WeddingMembersManagerProps {
  weddingId:   string
  isOwner:     boolean
  memberLimit: number
}

interface MemberRow {
  id:         string
  user_id:    string
  role:       WeddingMemberRole
  created_at: string
  full_name:  string | null
}

interface ApiErrorBody {
  error?: { message?: string }
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  return body?.error?.message ?? fallback
}

export default function WeddingMembersManager({ weddingId, isOwner, memberLimit }: WeddingMembersManagerProps) {
  const [loading, setLoading]         = useState(true)
  const [members, setMembers]         = useState<MemberRow[]>([])
  const [invites, setInvites]         = useState<WeddingInvite[]>([])
  const [selfUserId, setSelfUserId]   = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [removing, setRemoving]       = useState<string | null>(null)
  const [revoking, setRevoking]       = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null)

  const showLoadingSpinner = useDelayedLoading(loading)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/v1/weddings/${weddingId}/members`),
        isOwner ? fetch(`/api/v1/weddings/${weddingId}/invites`) : Promise.resolve(null),
      ])

      if (cancelled) return
      setSelfUserId(user?.id ?? null)

      if (membersRes.ok) {
        const body = await membersRes.json() as { data: MemberRow[] }
        if (!cancelled) setMembers(body.data)
      } else {
        toastError(await readErrorMessage(membersRes, 'Não foi possível carregar os membros.'))
      }

      if (invitesRes) {
        if (invitesRes.ok) {
          const body = await invitesRes.json() as { data: WeddingInvite[] }
          if (!cancelled) setInvites(body.data.filter((i) => i.status === 'pending'))
        } else {
          toastError(await readErrorMessage(invitesRes, 'Não foi possível carregar os convites.'))
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [weddingId, isOwner])

  async function createInvite() {
    if (creatingInvite) return
    setCreatingInvite(true)

    const res = await fetch(`/api/v1/weddings/${weddingId}/invites`, { method: 'POST' })

    if (!res.ok) {
      toastError(await readErrorMessage(res, 'Não foi possível gerar o convite.'))
      setCreatingInvite(false)
      return
    }

    const body = await res.json() as { data: WeddingInvite }
    setInvites((prev) => [body.data, ...prev])
    setCreatingInvite(false)
    toastSuccess('Link de convite gerado.')
  }

  async function revokeInvite(invite: WeddingInvite) {
    if (revoking) return
    setRevoking(invite.id)

    const res = await fetch(`/api/v1/weddings/${weddingId}/invites/${invite.id}`, { method: 'DELETE' })

    setRevoking(null)
    if (!res.ok) {
      toastError(await readErrorMessage(res, 'Não foi possível revogar o convite.'))
      return
    }

    setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    toastSuccess('Convite revogado.')
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/convite/${token}`
    try {
      await navigator.clipboard.writeText(link)
      toastSuccess('Link copiado.')
    } catch {
      toastError('Não foi possível copiar o link.')
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove || removing) return
    setRemoving(memberToRemove.user_id)

    const res = await fetch(`/api/v1/weddings/${weddingId}/members/${memberToRemove.user_id}`, { method: 'DELETE' })

    setRemoving(null)
    if (!res.ok) {
      toastError(await readErrorMessage(res, 'Não foi possível remover este membro.'))
      setMemberToRemove(null)
      return
    }

    setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id))
    setMemberToRemove(null)
    toastSuccess('Membro removido.')
  }

  const currentCount = members.length
  const limitReached = currentCount >= memberLimit

  if (loading) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        {showLoadingSpinner && <Spinner size={18} color="var(--wedding-color)" />} Carregando membros…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de membros */}
      <div className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <div className="px-6 pt-5 pb-3">
          <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)', margin: 0 }}>
            Membros ({currentCount} de {memberLimit})
          </h2>
          {!isOwner && (
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '4px 0 0' }}>
              Só o dono do casamento pode convidar ou remover pessoas.
            </p>
          )}
        </div>
        <div>
          {members.map((member, idx) => {
            const isSelf = member.user_id === selfUserId
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-6 py-3.5"
                style={{ borderTop: idx > 0 ? '1px solid #F8F3EE' : 'none' }}
              >
                <div
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '15px', fontWeight: 700,
                  }}
                >
                  {(member.full_name ?? 'M').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>
                    {member.full_name ?? 'Sem nome'} {isSelf && <span style={{ color: 'var(--muted-fg)', fontWeight: 500 }}>(você)</span>}
                  </div>
                </div>
                {member.role === 'owner' && (
                  <span
                    style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px',
                      background: '#F1E6D4', color: 'var(--wedding-color-dark)', flexShrink: 0,
                    }}
                  >
                    Dono
                  </span>
                )}
                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => setMemberToRemove(member)}
                    disabled={removing === member.user_id}
                    title="Remover membro"
                    aria-label="Remover membro"
                    style={{
                      border: 'none', background: 'transparent', color: '#C0553F',
                      cursor: removing === member.user_id ? 'not-allowed' : 'pointer',
                      padding: '6px', flexShrink: 0, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Convidar pessoa — só dono */}
      {isOwner && (
        <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)', margin: '0 0 4px' }}>
            Convidar pessoa
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Gere um link e envie para quem vai ajudar a planejar o casamento com acesso completo.
          </p>

          {limitReached ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                border: '1.5px dashed #EBDDD0', borderRadius: '12px', padding: '14px 16px',
              }}
            >
              <span style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
                {currentCount} de {memberLimit} usuários — faça upgrade para convidar mais.
              </span>
              <Link
                href="/perfil/planos"
                style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color)', textDecoration: 'underline' }}
              >
                Ver planos
              </Link>
            </div>
          ) : (
            <button
              onClick={createInvite}
              disabled={creatingInvite}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
                cursor: creatingInvite ? 'not-allowed' : 'pointer', opacity: creatingInvite ? 0.7 : 1,
              }}
            >
              {creatingInvite ? 'Gerando…' : 'Gerar link de convite'}
            </button>
          )}

          {invites.length > 0 && (
            <div className="mt-5 flex flex-col gap-2.5">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center gap-2"
                  style={{ border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '10px 12px' }}
                >
                  <input
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/convite/${invite.token}` : ''}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{
                      flex: 1, minWidth: '180px', border: 'none', outline: 'none',
                      fontSize: '13px', color: 'var(--muted-fg)', background: 'transparent',
                    }}
                  />
                  <button
                    onClick={() => copyInviteLink(invite.token)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      border: '1.5px solid #EBDDD0', background: 'transparent', color: 'var(--wedding-color)',
                      borderRadius: '10px', padding: '7px 12px', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer',
                    }}
                  >
                    <CopyIcon /> Copiar
                  </button>
                  <button
                    onClick={() => revokeInvite(invite)}
                    disabled={revoking === invite.id}
                    style={{
                      border: 'none', background: 'transparent', color: '#C0553F',
                      fontSize: '12.5px', fontWeight: 600, cursor: revoking === invite.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={memberToRemove !== null}
        onClose={() => { if (!removing) setMemberToRemove(null) }}
        title="Remover membro"
      >
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          {memberToRemove?.full_name ?? 'Este usuário'} perderá o acesso a este casamento. Deseja continuar?
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMemberToRemove(null)}
            disabled={removing !== null}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px',
              border: '1.5px solid #EBDDD0', background: 'transparent',
              color: 'var(--fg)', fontWeight: 600, fontSize: '14px',
              cursor: removing !== null ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmRemoveMember}
            disabled={removing !== null}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: '#C0553F', color: '#fff', fontWeight: 700, fontSize: '14px',
              cursor: removing !== null ? 'not-allowed' : 'pointer', opacity: removing !== null ? 0.7 : 1,
            }}
          >
            {removing !== null && <Spinner size={15} color="#fff" />}
            Sim, remover
          </button>
        </div>
      </Modal>
    </div>
  )
}
