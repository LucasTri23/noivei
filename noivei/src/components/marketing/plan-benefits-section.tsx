const BENEFITS = [
  {
    title: 'Nunca mais pergunte quem confirmou',
    description:
      'O RSVP faz o trabalho por vocês: cada convidado recebe um link único, confirma presença sozinho e o sistema confere o telefone antes de contar no total.',
    icon: RsvpIcon,
  },
  {
    title: 'Financeiro sem planilha',
    description:
      'Veja quanto já foi gasto, quanto ainda falta e organize parcelas e fornecedores num só lugar — sem fórmula quebrada nem aba perdida.',
    icon: FinancialIcon,
  },
  {
    title: 'Um site, tudo o que os convidados precisam',
    description:
      'Um único link com a história do casal, informações da cerimônia, lista de presentes e fotos — pronto para compartilhar no grupo da família.',
    icon: SiteIcon,
  },
  {
    title: 'Planejem juntos, sem bagunça',
    description:
      'Convide o parceiro, o cerimonialista ou a família para acompanhar tudo, cada um com permissão só no que precisa ver.',
    icon: CollabIcon,
  },
] as const

/**
 * Seção "Por que escolher o Wednest?" — 4 cards de benefício (não de
 * funcionalidade) baseados só em recursos reais do produto. Copy fixa,
 * reutilizável em qualquer página de marketing.
 */
export default function PlanBenefitsSection() {
  return (
    <section
      className="mx-auto"
      style={{ maxWidth: '1240px', padding: 'clamp(56px, 7vw, 96px) clamp(20px, 4vw, 44px)' }}
    >
      <div className="mx-auto text-center" style={{ maxWidth: '640px', marginBottom: 'clamp(36px, 5vw, 56px)' }}>
        <span
          className="rounded-full"
          style={{
            display: 'inline-block',
            fontSize: '12.5px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--wedding-color-dark)',
            background: 'var(--wedding-color-subtle)',
            padding: '6px 14px',
            marginBottom: '18px',
          }}
        >
          Por que o Wednest
        </span>
        <h2
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 42px)', lineHeight: 1.12, color: 'var(--fg)', margin: 0 }}
        >
          Menos planilha, mais presença no seu casamento.
        </h2>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {BENEFITS.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            data-reveal
            className="rounded-2xl"
            style={{
              background: 'var(--surface)',
              padding: 'clamp(24px, 2.6vw, 32px)',
              boxShadow: '0 8px 22px rgba(60,40,24,0.06)',
              border: '1px solid color-mix(in srgb, var(--wedding-color) 10%, transparent)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: '48px',
                height: '48px',
                background: 'var(--wedding-color-subtle)',
                color: 'var(--wedding-color-dark)',
                marginBottom: '18px',
              }}
            >
              <Icon />
            </div>
            <h3
              className="font-display"
              style={{ fontWeight: 600, fontSize: '19px', color: 'var(--fg)', margin: '0 0 8px', lineHeight: 1.25 }}
            >
              {title}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function RsvpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FinancialIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20V10M11 20V4M18 20v-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SiteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CollabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="16" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="2.1" />
      <path d="M2.8 19c0.6-3 3-5 5.7-5s5.1 2 5.7 5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14.5 14.4c2.3 0.3 4.1 2.1 4.7 4.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}
