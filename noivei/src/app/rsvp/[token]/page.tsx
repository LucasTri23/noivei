import type { Metadata } from 'next'

import RsvpForm from '@/components/rsvp/rsvp-form'
import { RsvpTokenSchema } from '@/lib/api/validation/rsvp.schema'
import { getRsvpByToken, type RsvpInfo } from '@/lib/rsvp/get-rsvp-by-token'
import { createSupabaseService } from '@/lib/supabase/service'

export const metadata: Metadata = {
  title:  'Confirme sua presença',
  robots: { index: false, follow: false },
}

interface RsvpPageProps {
  params: Promise<{ token: string }>
}

function formatWeddingDate(date: string | null): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function RsvpShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)', padding: '24px' }}
    >
      <div
        className="w-full overflow-hidden rounded-3xl bg-[var(--surface)]"
        style={{ maxWidth: '520px', boxShadow: '0 24px 60px rgba(42,30,16,0.14)' }}
      >
        {children}
      </div>
    </div>
  )
}

function RsvpNotFound() {
  return (
    <RsvpShell>
      <div style={{ padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💌</div>
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: '30px', color: 'var(--fg)', margin: '0 0 10px' }}
        >
          Convite não encontrado
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>
          Este link de confirmação é inválido ou expirou.
          Confira o link recebido ou fale com o casal para receber um novo convite.
        </p>
      </div>
    </RsvpShell>
  )
}

export default async function RsvpPage({ params }: RsvpPageProps) {
  const { token } = await params

  const parsedToken = RsvpTokenSchema.safeParse(decodeURIComponent(token))
  if (!parsedToken.success) return <RsvpNotFound />

  let rsvp: RsvpInfo | null = null
  try {
    const supabase = createSupabaseService()
    rsvp = await getRsvpByToken(supabase, parsedToken.data)
  } catch {
    // Ambiente sem service role configurado — trata como convite indisponível
    rsvp = null
  }

  if (!rsvp) return <RsvpNotFound />

  const weddingDate = formatWeddingDate(rsvp.wedding.wedding_date)
  const place = [rsvp.wedding.venue, rsvp.wedding.city].filter(Boolean).join(' · ')

  return (
    <RsvpShell>
      {/* Cabeçalho decorativo */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #2A1E10, #3A2A18)',
          color: '#FAF0E6', padding: '38px 36px', textAlign: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative">
          <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
            Casamento de
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,6vw,40px)', margin: '6px 0 0', lineHeight: 1.1 }}
          >
            {rsvp.wedding.couple_names}
          </h1>
          {(weddingDate || place) && (
            <p style={{ fontSize: '13.5px', color: 'rgba(250,240,230,0.7)', margin: '10px 0 0' }}>
              {[weddingDate, place].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '34px 36px 38px' }}>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 0 4px' }}>
          Olá,
        </p>
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: '28px', color: 'var(--fg)', margin: '0 0 8px', lineHeight: 1.15 }}
        >
          {rsvp.guest.name}
        </h2>
        <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6 }}>
          Você foi convidado(a) para este grande dia. Podemos contar com a sua presença?
        </p>

        <RsvpForm token={parsedToken.data} initialStatus={rsvp.guest.status} />

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '26px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Noivei
        </p>
      </div>
    </RsvpShell>
  )
}
