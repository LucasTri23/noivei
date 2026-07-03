import Link from 'next/link'
import SecurityForm from '@/components/perfil/security-form'

export const metadata = { title: 'Segurança' }

export default function SegurancaPage() {
  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Segurança
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 24px' }}>
        Atualize a senha de acesso da sua conta.
      </p>

      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', maxWidth: '480px' }}>
        <SecurityForm />
      </div>
    </div>
  )
}
