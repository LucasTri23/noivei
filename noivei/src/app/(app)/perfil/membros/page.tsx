import Link from 'next/link'
import { redirect } from 'next/navigation'

import WeddingMembersManager from '@/components/perfil/wedding-members-manager'
import { checkMemberLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'

export const metadata = { title: 'Membros do casamento' }

export default async function MembrosPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const wedding = await getUserWedding(supabase, user.id)
  if (!wedding) redirect('/onboarding')

  const limitCheck = await checkMemberLimit(supabase, wedding.id)

  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Membros do casamento
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 24px' }}>
        Junte contas para planejar o casamento junto com quem vocês quiserem.
      </p>

      <WeddingMembersManager weddingId={wedding.id} isOwner={wedding.isOwner} memberLimit={limitCheck.limit} />
    </div>
  )
}
