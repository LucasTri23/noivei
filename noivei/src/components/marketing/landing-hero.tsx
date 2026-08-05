import Link from 'next/link'
import DashboardPreview from '@/components/marketing/dashboard-preview'

const FEATURES = [
  'Timeline & checklist personalizado',
  'Convidados, RSVP e mesas',
  'Orçamento sob controle',
]

/**
 * Landing page pública (rota `/`) para visitantes deslogados — antes disso a
 * rota redirecionava direto pro /login sem nenhum conteúdo de marketing.
 */
export default function LandingHero() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Barra superior */}
      <header
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: '1240px', padding: 'clamp(18px, 3vw, 32px) clamp(20px, 4vw, 44px)' }}
      >
        <div className="flex items-center gap-2.5">
          <WednestMark />
          <span
            className="font-display"
            style={{ fontSize: '22px', fontWeight: 500, color: 'var(--wedding-color-dark)', letterSpacing: '0.02em' }}
          >
            Wednest
          </span>
        </div>
        <Link href="/login" className="text-sm font-semibold" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section
        className="mx-auto flex flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-10"
        style={{ maxWidth: '1240px', padding: 'clamp(8px, 2vw, 20px) clamp(20px, 4vw, 44px) clamp(56px, 7vw, 96px)' }}
      >
        {/* Copy */}
        <div className="flex flex-col items-start text-left lg:flex-1" style={{ maxWidth: '520px' }}>
          <span
            className="rounded-full"
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--wedding-color-dark)',
              background: 'var(--wedding-color-subtle)',
              padding: '6px 14px',
              marginBottom: '22px',
            }}
          >
            Planejamento de casamento
          </span>

          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.08, color: 'var(--fg)', margin: 0 }}
          >
            Planeje cada detalhe,
            <br />
            viva cada emoção.
          </h1>

          <p style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', color: 'var(--muted-fg)', marginTop: '20px', lineHeight: 1.6 }}>
            O Wednest reúne checklist, convidados, orçamento, mesas, fornecedores e o site do
            casal em um só lugar — para vocês aproveitarem cada etapa da jornada até o grande dia.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center" style={{ marginTop: '32px' }}>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full font-semibold"
              style={{
                background: 'var(--wedding-color)',
                color: '#FFFFFF',
                padding: '14px 30px',
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: '0 14px 30px rgba(198,148,58,0.28)',
              }}
            >
              Criar conta grátis
            </Link>
            <Link
              href="/planos"
              className="inline-flex items-center justify-center rounded-full font-semibold"
              style={{
                border: '1.5px solid color-mix(in srgb, var(--wedding-color) 40%, transparent)',
                color: 'var(--wedding-color-dark)',
                padding: '12.5px 28px',
                fontSize: '15px',
                textDecoration: 'none',
              }}
            >
              Conhecer planos
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center font-semibold"
              style={{ color: 'var(--fg)', padding: '14px 18px', fontSize: '15px', textDecoration: 'none' }}
            >
              Entrar
            </Link>
          </div>

          <div className="flex flex-col gap-3" style={{ marginTop: '38px' }}>
            {FEATURES.map((label) => (
              <div key={label} className="flex items-center gap-3" style={{ fontSize: '14.5px', color: 'var(--fg)' }}>
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)' }}
                >
                  <span className="block h-2 w-2 rounded-full" style={{ background: 'var(--wedding-color)' }} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Mockup do dashboard */}
        <div className="flex w-full justify-center lg:flex-1">
          <DashboardPreview />
        </div>
      </section>
    </div>
  )
}

function WednestMark() {
  return (
    <svg width="30" height="22" viewBox="0 0 76 56" fill="none">
      <defs>
        <linearGradient id="landing-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wedding-color-light)" />
          <stop offset="100%" stopColor="var(--wedding-color)" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="17" stroke="url(#landing-mark-grad)" strokeWidth="5" fill="none" />
      <circle cx="48" cy="28" r="17" stroke="url(#landing-mark-grad)" strokeWidth="5" fill="none" />
    </svg>
  )
}
