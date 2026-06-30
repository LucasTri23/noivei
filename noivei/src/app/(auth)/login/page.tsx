import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--fg)]">
        Entrar no noivei
      </h1>
      {/* TODO Sprint 1: LoginForm component */}
    </div>
  )
}
