'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

interface EnterWithAnotherAccountButtonProps {
  nextHref: string
}

// SEC-003: convite travado a um e-mail que não é o da conta logada agora — mesmo
// padrão de logout do LogoutButton (src/components/auth/logout-button.tsx), mas sem
// a confirmação de "Deseja realmente sair?" (aqui é o próprio fluxo de convite
// pedindo a troca de conta, não uma saída acidental) e voltando pro /login com
// `next` apontando de volta pra esta página de convite.
export default function EnterWithAnotherAccountButton({ nextHref }: EnterWithAnotherAccountButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  async function handleSwitchAccount() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push(`/login?next=${encodeURIComponent(nextHref)}`)
    router.refresh()
  }

  return (
    <button
      onClick={handleSwitchAccount}
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
      Entrar com outra conta
    </button>
  )
}
