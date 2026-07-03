import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import AppearanceSettings from '@/components/perfil/appearance-settings'

export const metadata = { title: 'Aparência' }

export default async function AparenciaPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, wedding_color')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const planId = (subscription?.plan_id ?? 'free') as PlanId

  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Aparência
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 24px' }}>
        Deixe o Noivei com a cara do casamento de vocês.
      </p>

      <AppearanceSettings
        weddingId={wedding?.id ?? null}
        weddingColor={wedding?.wedding_color ?? '#C6943A'}
        isPaid={isPaidPlan(planId)}
      />
    </div>
  )
}
