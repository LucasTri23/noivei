import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorCategory, VendorPlan } from '@/types/database'

// Página pública de aquisição — genuína landing de marketing, indexável (diferente
// das páginas privadas do app, que usam robots: noindex). Sem esse export, herdaria
// só o metadata genérico do RootLayout.
export const metadata = {
  title: 'Para Fornecedores',
  description:
    'Cadastre sua empresa no marketplace de fornecedores do Wednest e conecte-se com casais organizando o casamento agora — fotografia, buffet, decoração e muito mais.',
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const HOW_IT_WORKS = [
  { title: 'Cadastre sua empresa',       body: 'Conte quem você é, o que faz e mostre seu portfólio em poucos minutos.' },
  { title: 'Aguarde a aprovação',        body: 'Nossa equipe revisa cada cadastro antes de publicar no marketplace.' },
  { title: 'Receba casais interessados', body: 'Apareça nas buscas de casais organizando o casamento pela plataforma.' },
]

const FAQ = [
  {
    q: 'Quanto custa para me cadastrar?',
    a: 'O cadastro em si é gratuito. Você só escolhe um plano quando o seu perfil for aprovado e estiver pronto para ficar visível no marketplace.',
  },
  {
    q: 'Como funciona a aprovação?',
    a: 'Depois de enviar seu cadastro, nossa equipe revisa as informações e o portfólio antes de publicar seu perfil — isso ajuda a manter a qualidade do marketplace para os casais.',
  },
  {
    q: 'Posso editar meu perfil depois?',
    a: 'Sim, você pode atualizar os dados da sua empresa e do portfólio a qualquer momento pelo seu painel.',
  },
  {
    q: 'Em quanto tempo recebo uma resposta?',
    a: 'Nossa equipe revisa os cadastros o mais rápido possível — você será avisado assim que seu perfil for aprovado ou se precisar de algum ajuste.',
  },
]

/**
 * Vitrine pública pra fornecedores (`/para-fornecedores`) — preço vem SEMPRE do
 * banco (vendor_plans), nunca hardcoded: mesmo motivo de /planos usar `plans` ao
 * vivo, um admin editando o preço em fase futura (admin de fornecedores) não pode
 * deixar esta página desatualizada.
 */
export default async function ParaFornecedoresPage() {
  const supabase = await createSupabaseServer()

  const [{ data: { user } }, { data: plansData }, { data: categoriesData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('vendor_plans').select('*').eq('active', true).order('sort_order'),
    supabase.from('vendor_categories').select('*').eq('active', true).order('sort_order'),
  ])

  const plans      = (plansData ?? []) as VendorPlan[]
  const categories = (categoriesData ?? []) as VendorCategory[]

  // Apenas contas de fornecedor entram diretamente no cadastro.
  const { data: profile } = user
    ? await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
    : { data: null }
  const isVendor = profile?.account_type === 'vendor'
  const ctaHref = user && isVendor ? '/fornecedor/cadastro' : '/signup?next=/fornecedor/cadastro'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <header
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: '1240px', padding: 'clamp(18px, 3vw, 32px) clamp(20px, 4vw, 44px)' }}
      >
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
          <WednestMark />
          <span className="font-display" style={{ fontSize: '22px', fontWeight: 500, color: 'var(--wedding-color-dark)', letterSpacing: '0.02em' }}>
            Wednest
          </span>
        </Link>
        <Link href={user ? (isVendor ? '/fornecedor' : '/dashboard') : '/login?next=/fornecedor'} className="text-sm font-semibold" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
          {user ? 'Ir para o painel' : 'Entrar'}
        </Link>
      </header>

      {/* Hero */}
      <section
        className="mx-auto flex flex-col items-center text-center"
        style={{ maxWidth: '820px', padding: 'clamp(24px, 4vw, 48px) clamp(20px, 4vw, 44px) clamp(48px, 6vw, 80px)' }}
      >
        <span
          className="rounded-full"
          style={{
            fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--wedding-color-dark)', background: 'var(--wedding-color-subtle)', padding: '6px 14px', marginBottom: '22px',
          }}
        >
          Para fornecedores
        </span>

        <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.1, color: 'var(--fg)', margin: 0 }}>
          Conecte sua empresa a casais organizando o casamento agora.
        </h1>

        <p style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', color: 'var(--muted-fg)', marginTop: '18px', lineHeight: 1.6, maxWidth: '580px' }}>
          Cadastre seu negócio no marketplace de fornecedores do Wednest e apareça para centenas de casais planejando o grande dia — fotografia, buffet, decoração, música e muito mais.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center" style={{ marginTop: '32px' }}>
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-full font-semibold"
            style={{
              background: 'var(--wedding-color)', color: '#FFFFFF', padding: '14px 30px', fontSize: '15px',
              textDecoration: 'none', boxShadow: '0 14px 30px rgba(198,148,58,0.28)',
            }}
          >
            Cadastrar minha empresa
          </Link>
          <a href="#planos" className="inline-flex items-center justify-center font-semibold" style={{ color: 'var(--fg)', padding: '14px 18px', fontSize: '15px', textDecoration: 'none' }}>
            Ver planos
          </a>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto" style={{ maxWidth: '1000px', padding: '0 clamp(20px, 4vw, 44px) clamp(48px, 6vw, 72px)' }}>
        <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', textAlign: 'center', color: 'var(--fg)', marginBottom: '32px' }}>
          Como funciona
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <div
              key={item.title}
              style={{
                background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--wedding-color) 14%, transparent)',
                borderRadius: '16px', padding: '24px',
              }}
            >
              <div
                style={{
                  width: '34px', height: '34px', borderRadius: '10px', background: 'var(--wedding-color-subtle)',
                  color: 'var(--wedding-color-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, marginBottom: '14px',
                }}
              >
                {i + 1}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', marginBottom: '6px' }}>{item.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categorias */}
      {categories.length > 0 && (
        <section className="mx-auto" style={{ maxWidth: '1000px', padding: '0 clamp(20px, 4vw, 44px) clamp(48px, 6vw, 72px)' }}>
          <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', textAlign: 'center', color: 'var(--fg)', marginBottom: '24px' }}>
            Categorias no marketplace
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {categories.map((cat) => (
              <span
                key={cat.id}
                style={{
                  fontSize: '13.5px', fontWeight: 600, color: 'var(--wedding-color-dark)',
                  background: 'var(--wedding-color-subtle)', padding: '8px 16px', borderRadius: '999px',
                }}
              >
                {cat.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Planos — preço sempre ao vivo do banco, nunca hardcoded */}
      <section id="planos" className="mx-auto" style={{ maxWidth: '820px', padding: '0 clamp(20px, 4vw, 44px) clamp(48px, 6vw, 72px)' }}>
        <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', textAlign: 'center', color: 'var(--fg)', marginBottom: '32px' }}>
          Planos simples, sem letra miúda
        </h2>

        {plans.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id} style={{ background: 'var(--surface)', border: '1.5px solid var(--wedding-color)', borderRadius: '20px', padding: '28px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--fg)', marginBottom: '10px' }}>{plan.name}</h3>
                <div className="font-display" style={{ fontSize: '38px', fontWeight: 600, color: 'var(--wedding-color-dark)' }}>
                  {currencyFmt.format(plan.price_cents / 100)}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '4px', marginBottom: '18px' }}>
                  {plan.billing_type === 'monthly' ? 'por mês' : 'pagamento único, acesso vitalício'}
                </p>
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-full font-semibold"
                  style={{ background: 'var(--wedding-color)', color: '#FFFFFF', padding: '12px 24px', fontSize: '14px', textDecoration: 'none', width: '100%' }}
                >
                  Cadastrar minha empresa
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>Planos em breve.</p>
        )}
      </section>

      {/* FAQ */}
      <section className="mx-auto" style={{ maxWidth: '760px', padding: '0 clamp(20px, 4vw, 44px) clamp(56px, 7vw, 88px)' }}>
        <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px, 3vw, 32px)', textAlign: 'center', color: 'var(--fg)', marginBottom: '28px' }}>
          Perguntas frequentes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {FAQ.map((item) => (
            <details
              key={item.q}
              style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--wedding-color) 14%, transparent)', borderRadius: '14px', padding: '16px 18px' }}
            >
              <summary style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)', cursor: 'pointer' }}>{item.q}</summary>
              <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, marginTop: '10px' }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer
        className="mx-auto flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{
          maxWidth: '1240px', padding: 'clamp(24px, 3vw, 32px) clamp(20px, 4vw, 44px) clamp(40px, 5vw, 56px)',
          borderTop: '1px solid color-mix(in srgb, var(--wedding-color) 12%, transparent)', marginTop: 'clamp(24px, 3vw, 32px)',
        }}
      >
        <span className="font-display" style={{ fontSize: '16px', fontWeight: 500, color: 'var(--wedding-color-dark)' }}>Wednest</span>
        <span style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>© {new Date().getFullYear()} Wednest. Todos os direitos reservados.</span>
      </footer>
    </div>
  )
}

function WednestMark() {
  return (
    <svg width="30" height="22" viewBox="0 0 76 56" fill="none">
      <defs>
        <linearGradient id="para-fornecedores-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wedding-color-light)" />
          <stop offset="100%" stopColor="var(--wedding-color)" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="17" stroke="url(#para-fornecedores-mark-grad)" strokeWidth="5" fill="none" />
      <circle cx="48" cy="28" r="17" stroke="url(#para-fornecedores-mark-grad)" strokeWidth="5" fill="none" />
    </svg>
  )
}
