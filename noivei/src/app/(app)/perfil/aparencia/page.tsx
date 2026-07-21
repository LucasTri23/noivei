import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { resolveWeddingPlanId } from '@/lib/billing/check-limit'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import AppearanceSettings from '@/components/perfil/appearance-settings'

export const metadata = { title: 'Aparência' }

export default async function AparenciaPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userWedding = await getUserWedding(supabase, user.id)

  const { data: wedding } = userWedding
    ? await supabase
        .from('weddings')
        .select('id, wedding_color')
        .eq('id', userWedding.id)
        .maybeSingle()
    : { data: null }

  const planId: PlanId = userWedding ? await resolveWeddingPlanId(supabase, userWedding.id) : 'free'

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
