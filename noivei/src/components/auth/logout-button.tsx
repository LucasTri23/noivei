'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import Spinner from '@/components/ui/spinner'

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  async function handleLogout() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 20px', background: 'transparent', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: '#FBEEE6', color: '#C0553F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {showSpinner ? <Spinner size={16} color="#C0553F" /> : <LogoutIcon />}
      </div>
      <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 500, color: '#C0553F' }}>
        {loading ? 'Saindo…' : 'Sair da conta'}
      </span>
    </button>
  )
}
