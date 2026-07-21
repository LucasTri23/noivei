'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { WEDDING_MODULE_KEYS } from '@/lib/api/validation/invite.schema'
import { WEDDING_MODULE_LABELS } from '@/constants/wedding-modules'
import { toastError, toastSuccess } from '@/store/toast.store'
import type {
  WeddingInvite,
  WeddingMemberPermissions,
  WeddingMemberRole,
  WeddingModuleKey,
} from '@/types/database'

interface WeddingMembersManagerProps {
  weddingId:        string
  isOwner:          boolean
  // Dono OU membro com o papel "Noivo(a)" (full_access) — quem pode ver/gerar/revogar
  // convites. Remover pessoa e editar permissões de outra pessoa continuam exclusivos
  // do dono literal (ver `isOwner` nos botões abaixo).
  canManageInvites: boolean
  memberLimit:      number
}

interface MemberRow {
  id:          string
  user_id:     string
  role:        WeddingMemberRole
  permissions: WeddingMemberPermissions
  created_at:  string
  full_name:   string | null
  email:       string | null
}

type RoleChoice = 'noivo' | 'outro'

type ModuleSelection = Partial<Record<WeddingModuleKey, boolean>>

// full_name pode estar vazio (conta nunca preencheu o nome) — mostra o e-mail nesse
// caso, é o único identificador que sempre existe. "Sem nome" sozinho não ajudava
// o dono a saber quem é quem na lista.
function displayName(member: Pick<MemberRow, 'full_name' | 'email'>): string {
  return member.full_name || member.email || 'Sem nome'
}

// Resumo legível do papel do membro — "Dono"/"Noivo(a)" já aparecem como badge
// separado (ver render abaixo), esta função só cobre o caso de papel restrito.
function permissionsSummary(permissions: WeddingMemberPermissions): string {
  if (permissions.full_access) return 'Acesso completo'
  const active = WEDDING_MODULE_KEYS.filter((key) => permissions.modules?.[key])
  if (active.length === 0) return 'Sem acesso a nenhum módulo'
  return `Acesso: ${active.map((key) => WEDDING_MODULE_LABELS[key]).join(', ')}`
}

function roleToggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: '9px 18px', borderRadius: '99px', fontSize: '13.5px',
    fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
    color: active ? '#fff' : '#9A7A60',
    transition: 'all 0.18s',
  }
}

interface ModuleSelectorProps {
  roleChoice:      RoleChoice
  onRoleChoice:    (role: RoleChoice) => void
  modules:         ModuleSelection
  onModulesChange: (modules: ModuleSelection) => void
}

function ModuleSelector({ roleChoice, onRoleChoice, modules, onModulesChange }: ModuleSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onRoleChoice('noivo')} style={roleToggleStyle(roleChoice === 'noivo')}>
          Noivo(a)
        </button>
        <button type="button" onClick={() => onRoleChoice('outro')} style={roleToggleStyle(roleChoice === 'outro')}>
          Outro papel
        </button>
      </div>
      {roleChoice === 'outro' && (
        <div
          className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"
          style={{ border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '14px 16px' }}
        >
          {WEDDING_MODULE_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2"
              style={{ fontSize: '13.5px', color: 'var(--fg)', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={modules[key] === true}
                onChange={(e) => onModulesChange({ ...modules, [key]: e.target.checked })}
              />
              {WEDDING_MODULE_LABELS[key]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
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

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  return body?.error?.message ?? fallback
}

export default function WeddingMembersManager({ weddingId, isOwner, canManageInvites, memberLimit }: WeddingMembersManagerProps) {
  const [loading, setLoading]         = useState(true)
  const [members, setMembers]         = useState<MemberRow[]>([])
  const [invites, setInvites]         = useState<WeddingInvite[]>([])
  const [selfUserId, setSelfUserId]   = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [removing, setRemoving]       = useState<string | null>(null)
  const [revoking, setRevoking]       = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null)

  const [inviteRole, setInviteRole]       = useState<RoleChoice>('noivo')
  const [inviteModules, setInviteModules] = useState<ModuleSelection>({})

  const [editingMember, setEditingMember]   = useState<MemberRow | null>(null)
  const [editRole, setEditRole]             = useState<RoleChoice>('noivo')
  const [editModules, setEditModules]       = useState<ModuleSelection>({})
  const [savingPermissions, setSavingPermissions] = useState(false)

  const showLoadingSpinner = useDelayedLoading(loading)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/v1/weddings/${weddingId}/members`),
        canManageInvites ? fetch(`/api/v1/weddings/${weddingId}/invites`) : Promise.resolve(null),
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
  }, [weddingId, canManageInvites])

  async function createInvite() {
    if (creatingInvite) return
    setCreatingInvite(true)

    // "Noivo(a)" = sem body (full_access, comportamento de hoje). "Outro papel" manda
    // full_access: false + só os módulos marcados.
    const permissions: WeddingMemberPermissions | undefined = inviteRole === 'outro'
      ? { full_access: false, modules: inviteModules }
      : undefined

    const res = await fetch(`/api/v1/weddings/${weddingId}/invites`, {
      method: 'POST',
      ...(permissions
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions }) }
        : {}),
    })

    if (!res.ok) {
      toastError(await readErrorMessage(res, 'Não foi possível gerar o convite.'))
      setCreatingInvite(false)
      return
    }

    const body = await res.json() as { data: WeddingInvite }
    setInvites((prev) => [body.data, ...prev])
    setCreatingInvite(false)
    setInviteRole('noivo')
    setInviteModules({})
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

  function openEditPermissions(member: MemberRow) {
    setEditingMember(member)
    if (member.permissions.full_access) {
      setEditRole('noivo')
      setEditModules({})
    } else {
      setEditRole('outro')
      setEditModules({ ...member.permissions.modules })
    }
  }

  async function savePermissions() {
    if (!editingMember || savingPermissions) return
    setSavingPermissions(true)

    const permissions: WeddingMemberPermissions = editRole === 'noivo'
      ? { full_access: true }
      : { full_access: false, modules: editModules }

    const res = await fetch(`/api/v1/weddings/${weddingId}/members/${editingMember.user_id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ permissions }),
    })

    setSavingPermissions(false)
    if (!res.ok) {
      toastError(await readErrorMessage(res, 'Não foi possível atualizar as permissões.'))
      return
    }

    setMembers((prev) => prev.map((m) => (m.user_id === editingMember.user_id ? { ...m, permissions } : m)))
    setEditingMember(null)
    toastSuccess('Permissões atualizadas.')
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
          {!canManageInvites && (
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '4px 0 0' }}>
              Só o dono do casamento ou um membro com acesso completo pode convidar pessoas.
            </p>
          )}
          {canManageInvites && !isOwner && (
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '4px 0 0' }}>
              Remover ou editar permissões de outros membros é exclusivo do dono do casamento.
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
                  {displayName(member).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>
                    {displayName(member)} {isSelf && <span style={{ color: 'var(--muted-fg)', fontWeight: 500 }}>(você)</span>}
                  </div>
                  {member.role !== 'owner' && (
                    <div style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                      {permissionsSummary(member.permissions)}
                    </div>
                  )}
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
                    onClick={() => openEditPermissions(member)}
                    title="Editar permissões"
                    aria-label="Editar permissões"
                    style={{
                      border: 'none', background: 'transparent', color: 'var(--wedding-color)',
                      cursor: 'pointer', padding: '6px', flexShrink: 0, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <PencilIcon />
                  </button>
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

      {/* Convidar pessoa — dono ou membro com acesso completo */}
      {canManageInvites && (
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
            <div className="flex flex-col gap-4">
              <ModuleSelector
                roleChoice={inviteRole}
                onRoleChoice={setInviteRole}
                modules={inviteModules}
                onModulesChange={setInviteModules}
              />
              <button
                onClick={createInvite}
                disabled={creatingInvite}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start',
                  background: 'var(--wedding-color)', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
                  cursor: creatingInvite ? 'not-allowed' : 'pointer', opacity: creatingInvite ? 0.7 : 1,
                }}
              >
                {creatingInvite ? 'Gerando…' : 'Gerar link de convite'}
              </button>
            </div>
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
          {memberToRemove ? displayName(memberToRemove) : 'Este usuário'} perderá o acesso a este casamento. Deseja continuar?
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

      <Modal
        open={editingMember !== null}
        onClose={() => { if (!savingPermissions) setEditingMember(null) }}
        title="Editar permissões"
      >
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Escolha o que {editingMember ? displayName(editingMember) : 'este usuário'} pode acessar neste casamento.
        </p>
        <ModuleSelector
          roleChoice={editRole}
          onRoleChoice={setEditRole}
          modules={editModules}
          onModulesChange={setEditModules}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={() => setEditingMember(null)}
            disabled={savingPermissions}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px',
              border: '1.5px solid #EBDDD0', background: 'transparent',
              color: 'var(--fg)', fontWeight: 600, fontSize: '14px',
              cursor: savingPermissions ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={savePermissions}
            disabled={savingPermissions}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: 'var(--wedding-color)', color: '#fff', fontWeight: 700, fontSize: '14px',
              cursor: savingPermissions ? 'not-allowed' : 'pointer', opacity: savingPermissions ? 0.7 : 1,
            }}
          >
            {savingPermissions && <Spinner size={15} color="#fff" />}
            Salvar
          </button>
        </div>
      </Modal>
    </div>
  )
}
