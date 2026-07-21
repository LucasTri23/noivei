'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'

interface AcceptInviteButtonProps {
  token: string
}

interface AlreadyInWeddingDetails {
  requiresConfirmation?: boolean
  isOwner?:              boolean
  weddingCoupleNames?:   string | null
}

interface AcceptInviteErrorBody {
  error?: {
    code?:    string
    message?: string
    details?: AlreadyInWeddingDetails
  }
}

export default function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<AlreadyInWeddingDetails | null>(null)
  const showSpinner = useDelayedLoading(loading)
  // Guarda por ref (não só por state): dois cliques na mesma tick veem `loading`
  // ainda `false` (o setState do primeiro clique não commitou a re-render a
  // tempo), então só o state não bastava pra impedir duas requisições em corrida.
  const submittingRef = useRef(false)

  async function accept(confirmLeaveCurrentWedding: boolean) {
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)

    const res = await fetch(`/api/v1/invites/${encodeURIComponent(token)}/accept`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirm_leave_current_wedding: confirmLeaveCurrentWedding }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as AcceptInviteErrorBody | null
      submittingRef.current = false
      setLoading(false)

      // Ainda não confirmou: em vez de só mostrar o erro, abre o modal perguntando
      // se quer sair do casamento atual — a API não decide isso sozinha.
      if (!confirmLeaveCurrentWedding && body?.error?.code === 'ALREADY_IN_ANOTHER_WEDDING' && body.error.details?.requiresConfirmation) {
        setConfirmInfo(body.error.details)
        return
      }

      toastError(body?.error?.message ?? 'Não foi possível aceitar o convite. Tente novamente.')
      return
    }

    toastSuccess('Convite aceito! Bem-vindo(a) ao casamento.')
    router.push('/dashboard')
    router.refresh()
  }

  const weddingName = confirmInfo?.weddingCoupleNames ?? 'o seu casamento atual'

  return (
    <>
      <button
        onClick={() => accept(false)}
        disabled={loading}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'var(--wedding-color)', color: '#fff', border: 'none',
          borderRadius: '14px', padding: '15px 20px',
          fontWeight: 700, fontSize: '15px',
          cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 35%, transparent)',
        }}
      >
        {showSpinner && <Spinner color="#fff" />}
        Aceitar convite
      </button>

      <Modal
        open={confirmInfo !== null}
        onClose={() => { if (!loading) setConfirmInfo(null) }}
        title="Sair do casamento atual?"
      >
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          {confirmInfo?.isOwner ? (
            <>
              Sua conta já é a <strong>dona</strong> do casamento de {weddingName}. Para aceitar este convite,
              esse casamento será marcado para exclusão — <strong>todos os dados (convidados, checklist,
              financeiro, site, arquivos e demais membros) serão apagados definitivamente em 30 dias</strong>,
              o mesmo prazo usado para exclusão de conta. Essa ação não pode ser desfeita depois desse prazo.
            </>
          ) : (
            <>
              Sua conta já participa do casamento de {weddingName} como convidado(a). Para aceitar este novo
              convite, você será removido(a) de lá — os dados desse casamento não serão afetados, eles
              pertencem ao dono e continuam intactos para quem ficar.
            </>
          )}
          {' '}Deseja continuar?
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setConfirmInfo(null)}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px',
              border: '1.5px solid #EBDDD0', background: 'transparent',
              color: 'var(--fg)', fontWeight: 600, fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { setConfirmInfo(null); accept(true) }}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: '#C0553F', color: '#fff', fontWeight: 700, fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {showSpinner && <Spinner size={15} color="#fff" />}
            Sim, sair e aceitar
          </button>
        </div>
      </Modal>
    </>
  )
}
