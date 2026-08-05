'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import PasswordInput from '@/components/auth/password-input'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError } from '@/store/toast.store'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'

const CONFIRM_TEXT = 'EXCLUIR MINHA CONTA'

interface DeleteAccountFields {
  currentPassword: string
  confirmText:     string
}

interface ApiErrorBody {
  error?: { message?: string }
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '6px',
}
const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  fontSize: '15px', color: 'var(--fg)', background: '#FFFFFF', outline: 'none', width: '100%',
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// SEC-009: exclusão de conta agora exige senha atual + digitar "EXCLUIR MINHA
// CONTA" (confirmação textual, comparada exatamente) — antes bastava confirmar num
// modal, sem prova de posse da senha. A senha atual é validada de novo no servidor
// (rota DELETE), este formulário só habilita o botão quando os dois campos batem.
export default function DeleteAccountButton() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, control, reset } = useForm<DeleteAccountFields>({
    defaultValues: { currentPassword: '', confirmText: '' },
  })
  const currentPassword = useWatch({ control, name: 'currentPassword' })
  const confirmText     = useWatch({ control, name: 'confirmText' })
  const canSubmit        = currentPassword.length > 0 && confirmText === CONFIRM_TEXT

  function closeModal() {
    if (loading) return
    setOpen(false)
    reset()
  }

  async function onSubmit(data: DeleteAccountFields) {
    if (data.currentPassword.length === 0 || data.confirmText !== CONFIRM_TEXT) return
    setLoading(true)

    const response = await fetch('/api/v1/account/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: data.currentPassword }),
    })

    if (!response.ok) {
      const body = (await response.json()) as ApiErrorBody
      setLoading(false)
      toastError(body.error?.message ?? 'Não foi possível processar a exclusão. Tente novamente.')
      return
    }

    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '13px 16px', borderRadius: '12px',
          border: '1.5px solid #F2DADA', background: 'transparent',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: '#C0553F' }}><TrashIcon /></span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#C0553F' }}>
          Excluir minha conta
        </span>
      </button>

      <Modal open={open} onClose={closeModal} title="Excluir minha conta">
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Seu casamento e todos os dados serão marcados para exclusão e removidos
          definitivamente em 30 dias, conforme a LGPD. Nesse período, você pode
          reativar a conta entrando em contato com o suporte.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0 }}>
            Por segurança, confirme sua identidade para continuar.
          </p>

          <div>
            <label style={labelStyle} htmlFor="delete-current-password">Senha atual</label>
            <PasswordInput
              id="delete-current-password"
              placeholder="Sua senha atual"
              register={register('currentPassword', { required: true })}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="delete-confirm-text">
              Digite <strong>{CONFIRM_TEXT}</strong> para confirmar
            </label>
            <input
              id="delete-confirm-text"
              type="text"
              autoComplete="off"
              placeholder={CONFIRM_TEXT}
              style={inputStyle}
              {...register('confirmText', { required: true })}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={closeModal}
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
              type="submit"
              disabled={loading || !canSubmit}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: '#C0553F', color: '#fff', fontWeight: 700, fontSize: '14px',
                cursor: loading || !canSubmit ? 'not-allowed' : 'pointer', opacity: loading || !canSubmit ? 0.6 : 1,
              }}
            >
              {showSpinner && <Spinner size={15} color="#fff" />}
              {loading ? 'Excluindo…' : 'Sim, excluir'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
