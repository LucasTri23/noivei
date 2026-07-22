import { createSupabaseServer } from '@/lib/supabase/server'
import { getUserWedding, hasModuleAccess } from '@/lib/weddings/get-user-wedding'
import { WEDDING_MODULE_LABELS } from '@/constants/wedding-modules'
import type { WeddingModuleKey } from '@/types/database'

interface ModuleAccessGateProps {
  module:   WeddingModuleKey
  children: React.ReactNode
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/**
 * Bloqueia `children` para membros do casamento sem acesso ao módulo — dono e
 * membros com `full_access` sempre passam (ver `hasModuleAccess`). Complementa
 * (não substitui) o `PaywallGate`: um módulo pode exigir plano pago E permissão
 * de módulo ao mesmo tempo, e os dois gates coexistem sem conflito.
 *
 * Falha fechado: sem usuário autenticado ou sem casamento resolvido, trata como
 * sem acesso — nesses casos o próprio layout de (app) já deveria ter redirecionado
 * para /login antes de chegar aqui, mas o gate não assume isso.
 */
export default async function ModuleAccessGate({ module, children }: ModuleAccessGateProps) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const wedding = user ? await getUserWedding(supabase, user.id) : null
  const allowed = wedding ? hasModuleAccess(wedding, module) : false

  if (allowed) return <>{children}</>

  const moduleName = WEDDING_MODULE_LABELS[module]

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div
        className="relative w-full overflow-hidden rounded-2xl p-8 text-center sm:p-10"
        style={{
          maxWidth: '520px',
          background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
          color: '#FAF0E6',
          boxShadow: '0 16px 40px rgba(60,40,24,0.18)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 16%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: '58px', height: '58px', borderRadius: '18px', marginBottom: '18px',
              background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)',
              color: 'var(--wedding-color-light)',
            }}
          >
            <LockIcon />
          </div>

          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '99px',
              background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)',
              color: 'var(--wedding-color-light)',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: '14px',
            }}
          >
            Acesso restrito
          </div>

          <h2
            className="font-display"
            style={{ fontSize: 'clamp(24px,3.4vw,30px)', fontWeight: 500, color: '#FAF0E6', lineHeight: 1.15, marginBottom: '10px' }}
          >
            Você não tem permissão para acessar {moduleName}
          </h2>

          <p style={{ fontSize: '14px', color: 'rgba(250,240,230,0.65)', lineHeight: 1.6, margin: '0 auto', maxWidth: '400px' }}>
            Fale com o dono do casamento se precisar de acesso a esta área.
          </p>
        </div>
      </div>
    </div>
  )
}
