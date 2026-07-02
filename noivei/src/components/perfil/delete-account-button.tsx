'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import Modal from '@/components/ui/modal'

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

export default function DeleteAccountButton() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')

    // LGPD: soft delete — os dados só são removidos definitivamente após 30 dias
    // TODO Fase 2: rota de API com service role para anonimizar e excluir a conta (auth.users) de fato
    const supabase = createSupabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: dbError } = await supabase
      .from('weddings')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (dbError) {
      setLoading(false)
      setError('Não foi possível processar a exclusão. Tente novamente.')
      return
    }

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

      <Modal open={open} onClose={() => { if (!loading) setOpen(false) }} title="Excluir minha conta">
        <p style={{ fontSize: '14px', color: '#9A7A60', lineHeight: 1.6, margin: '0 0 18px' }}>
          Seu casamento e todos os dados serão marcados para exclusão e removidos
          definitivamente em 30 dias, conforme a LGPD. Nesse período, você pode
          reativar a conta entrando em contato com o suporte. Deseja continuar?
        </p>
        {error && (
          <p style={{ fontSize: '13px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', margin: '0 0 14px' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setOpen(false)}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px',
              border: '1.5px solid #EBDDD0', background: 'transparent',
              color: '#3C2818', fontWeight: 600, fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: '#C0553F', color: '#fff', fontWeight: 700, fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Excluindo…' : 'Sim, excluir'}
          </button>
        </div>
      </Modal>
    </>
  )
}
