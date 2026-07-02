import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import NotificationSettings from '@/components/perfil/notification-settings'

export const metadata = { title: 'Notificações' }

export default async function NotificacoesPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('notify_timeline, notify_rsvp')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: '#9A7A60', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#3C2818', margin: '10px 0 6px' }}
      >
        Notificações
      </h1>
      <p style={{ fontSize: '14.5px', color: '#9A7A60', margin: '0 0 24px' }}>
        Escolha sobre o que você quer ser avisado(a).
      </p>

      <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <NotificationSettings
          userId={user.id}
          initial={{
            notify_timeline: profile?.notify_timeline ?? true,
            notify_rsvp:     profile?.notify_rsvp ?? true,
          }}
        />
      </div>
    </div>
  )
}
