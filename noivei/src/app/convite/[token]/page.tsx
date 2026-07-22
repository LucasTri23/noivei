import type { Metadata } from 'next'
import Link from 'next/link'

import AcceptInviteButton from '@/components/invites/accept-invite-button'
import { InviteTokenSchema } from '@/lib/api/validation/invite.schema'
import { getInviteByToken, type InviteInfo } from '@/lib/invites/get-invite-by-token'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveBrandDarkGradient } from '@/lib/theme/wedding-color'

export const metadata: Metadata = {
  title:  'Convite de casamento',
  robots: { index: false, follow: false },
}

interface InvitePageProps {
  params: Promise<{ token: string }>
}

function InviteShell({ children }: { children: React.ReactNode }) {
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

function InviteNotFound() {
  return (
    <InviteShell>
      <div style={{ padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💌</div>
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: '30px', color: 'var(--fg)', margin: '0 0 10px' }}
        >
          Convite não encontrado
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>
          Este link de convite é inválido, expirou ou já foi usado.
          Peça ao dono do casamento para gerar um novo link.
        </p>
      </div>
    </InviteShell>
  )
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  const parsedToken = InviteTokenSchema.safeParse(decodeURIComponent(token))
  if (!parsedToken.success) return <InviteNotFound />

  let invite: InviteInfo | null = null
  try {
    const service = createSupabaseService()
    invite = await getInviteByToken(service, parsedToken.data)
  } catch {
    // Ambiente sem service role configurado — trata como convite indisponível
    invite = null
  }

  if (!invite || invite.status !== 'pending' || invite.expired) return <InviteNotFound />

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const inviteHref = `/convite/${encodeURIComponent(parsedToken.data)}`

  // Plano Gratuito nunca sobrescreve o marrom padrão — só aplica quando a API já
  // devolveu a cor secundária (isso só acontece no plano pago, ver getInviteByToken).
  const brandDarkGradient = invite.weddingColorSecondary
    ? deriveBrandDarkGradient(invite.weddingColorSecondary)
    : null
  const brandDarkGradientVars = brandDarkGradient
    ? ({
        '--brand-dark-gradient-from': brandDarkGradient.from,
        '--brand-dark-gradient-to':   brandDarkGradient.to,
      } as React.CSSProperties)
    : undefined

  return (
    <InviteShell>
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
            Convite para o casamento de
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,6vw,40px)', margin: '6px 0 0', lineHeight: 1.1 }}
          >
            {invite.weddingCoupleNames}
          </h1>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '34px 36px 38px' }}>
        {user ? (
          <>
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Você foi convidado(a) a acessar este casamento junto com o casal, com acesso
              completo ao checklist, convidados, financeiro e mais. Deseja aceitar?
            </p>
            <AcceptInviteButton token={parsedToken.data} />
          </>
        ) : (
          <>
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Entre ou crie uma conta Wednest para aceitar o convite.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href={`/login?next=${encodeURIComponent(inviteHref)}`}
                style={{
                  flex: 1, minWidth: '160px', textAlign: 'center',
                  background: 'var(--wedding-color)', color: '#fff', textDecoration: 'none',
                  borderRadius: '14px', padding: '15px 20px', fontWeight: 700, fontSize: '15px',
                  boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 35%, transparent)',
                }}
              >
                Entrar
              </Link>
              <Link
                href={`/signup?next=${encodeURIComponent(inviteHref)}`}
                style={{
                  flex: 1, minWidth: '160px', textAlign: 'center',
                  background: 'transparent', color: 'var(--muted-fg)',
                  border: '1.5px solid var(--border)', textDecoration: 'none',
                  borderRadius: '14px', padding: '15px 20px', fontWeight: 600, fontSize: '15px',
                }}
              >
                Criar conta
              </Link>
            </div>
          </>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '26px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </InviteShell>
  )
}
