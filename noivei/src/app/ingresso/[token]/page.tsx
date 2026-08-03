import type { Metadata } from 'next'
import QRCode from 'qrcode'

import { RsvpTokenSchema } from '@/lib/api/validation/rsvp.schema'
import { getTicketByToken, type TicketInfo } from '@/lib/checkin/get-ticket-by-token'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveBrandDarkGradient } from '@/lib/theme/wedding-color'

export const metadata: Metadata = {
  title:  'Seu ingresso',
  robots: { index: false, follow: false },
}

interface IngressoPageProps {
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

function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)', padding: '24px' }}
    >
      <div
        className="w-full overflow-hidden rounded-3xl bg-[var(--surface)]"
        style={{ maxWidth: '480px', boxShadow: '0 24px 60px rgba(42,30,16,0.14)' }}
      >
        {children}
      </div>
    </div>
  )
}

function TicketNotAvailable() {
  return (
    <TicketShell>
      <div style={{ padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎟️</div>
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: '28px', color: 'var(--fg)', margin: '0 0 10px' }}
        >
          Ingresso indisponível
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>
          Este link não está disponível no momento. Confirme sua presença pelo convite recebido
          para liberar seu ingresso, ou fale com o casal.
        </p>
      </div>
    </TicketShell>
  )
}

export default async function IngressoPage({ params }: IngressoPageProps) {
  const { token } = await params

  const parsedToken = RsvpTokenSchema.safeParse(decodeURIComponent(token))
  if (!parsedToken.success) return <TicketNotAvailable />

  let ticket: TicketInfo | null = null
  try {
    const supabase = createSupabaseService()
    ticket = await getTicketByToken(supabase, parsedToken.data)
  } catch {
    // Ambiente sem service role configurado — trata como ingresso indisponível
    ticket = null
  }

  if (!ticket) return <TicketNotAvailable />

  // Encoda o token CRU (não uma URL) — o leitor é a tela de check-in deste mesmo
  // app (src/app/(app)/checkin/page.tsx), não um app de QR genérico, então não
  // precisa ser um link clicável; um texto mais curto também deixa o QR code
  // mais denso/fácil de ler numa festa com pouca luz.
  const qrDataUrl = await QRCode.toDataURL(parsedToken.data, { margin: 1, width: 260 })

  const weddingDate = formatWeddingDate(ticket.wedding.wedding_date)
  const place = [ticket.wedding.venue, ticket.wedding.city].filter(Boolean).join(' · ')

  // Plano Gratuito nunca sobrescreve o marrom padrão — mesmo critério da página de RSVP.
  const brandDarkGradient = ticket.wedding.wedding_color_secondary
    ? deriveBrandDarkGradient(ticket.wedding.wedding_color_secondary)
    : null
  const brandDarkGradientVars = brandDarkGradient
    ? ({
        '--brand-dark-gradient-from': brandDarkGradient.from,
        '--brand-dark-gradient-to':   brandDarkGradient.to,
      } as React.CSSProperties)
    : undefined

  return (
    <TicketShell>
      {/* Cabeçalho decorativo */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
          color: '#FAF0E6', padding: '38px 36px', textAlign: 'center',
          ...brandDarkGradientVars,
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
            Ingresso do casamento de
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(28px,5.5vw,36px)', margin: '6px 0 0', lineHeight: 1.1 }}
          >
            {ticket.wedding.couple_names}
          </h1>
          {(weddingDate || place) && (
            <p style={{ fontSize: '13.5px', color: 'rgba(250,240,230,0.7)', margin: '10px 0 0' }}>
              {[weddingDate, place].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '34px 36px 38px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 0 4px' }}>
          Ingresso de
        </p>
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: '26px', color: 'var(--fg)', margin: '0 0 6px', lineHeight: 1.15 }}
        >
          {ticket.guest.name}
        </h2>
        {ticket.guest.party_size > 1 && (
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '0 0 20px' }}>
            Válido para até {ticket.guest.party_size} pessoas
          </p>
        )}

        <div
          style={{
            display: 'inline-block', padding: '16px', borderRadius: '20px',
            background: '#fff', boxShadow: '0 8px 22px rgba(60,40,24,0.1)', margin: '10px 0 22px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado em runtime, sem domínio fixo para configurar no next/image */}
          <img src={qrDataUrl} alt="QR code do ingresso" width={220} height={220} style={{ display: 'block' }} />
        </div>

        <p style={{ fontSize: '13px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
          Mostre este QR code na entrada do casamento para confirmar sua chegada.
        </p>

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '26px' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </TicketShell>
  )
}
