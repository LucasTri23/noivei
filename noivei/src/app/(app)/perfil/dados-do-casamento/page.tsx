import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import WeddingDataForm from '@/components/perfil/wedding-data-form'

export const metadata = { title: 'Dados do casamento' }

export default async function DadosDoCasamentoPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, bride_name, groom_name, wedding_date, venue, city, budget, style, rsvp_message_template')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!wedding) redirect('/onboarding')

  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Dados do casamento
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 24px' }}>
        Confirme e atualize as informações do grande dia — data, local, orçamento e estilo.
      </p>

      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <WeddingDataForm
          weddingId={wedding.id}
          initial={{
            bride_name:   wedding.bride_name,
            groom_name:   wedding.groom_name,
            wedding_date: wedding.wedding_date,
            venue:        wedding.venue,
            city:         wedding.city,
            budget:       wedding.budget,
            style:        wedding.style,
            rsvp_message_template: wedding.rsvp_message_template,
          }}
        />
      </div>
    </div>
  )
}
