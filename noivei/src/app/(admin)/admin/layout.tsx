import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { createSupabaseServer } from '@/lib/supabase/server'

// Nenhum link no app leva aqui de propósito — é uma URL que só quem já sabe da sua
// existência acessa. Não-admin autenticado cai em notFound() (não redirect/403), pro
// painel não ser revelado a quem não é admin; só usuário sem sessão nenhuma vai pro
// login normal.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // Log temporário de diagnóstico (aparece nos Function Logs da Vercel) — sem isso,
  // uma falha na consulta (RLS, erro de rede etc.) e "não é admin de verdade" davam
  // exatamente o mesmo 404, sem jeito de distinguir os dois casos à distância.
  console.log('[admin-layout] checagem de acesso:', {
    userId: user.id,
    email:  user.email,
    role:   profile?.role ?? null,
    error:  profileError?.message ?? null,
  })

  if (profile?.role !== 'admin') notFound()

  const NAV_ITEMS = [
    { href: '/admin',                  label: 'Dashboard' },
    { href: '/admin/usuarios',         label: 'Usuários' },
    { href: '/admin/planos',           label: 'Planos & limites' },
    { href: '/admin/planos/features',  label: 'Tabela de comparação' },
    { href: '/admin/cupons',           label: 'Cupons' },
  ]

  return (
    <div className="flex min-h-screen" style={{ background: '#F4EFE7', fontFamily: 'var(--font-body)' }}>
      <aside
        style={{
          width: '220px', flexShrink: 0, background: '#2A1E10', color: '#FAF0E6',
          padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: '4px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C89070', marginBottom: '18px' }}>
          Wednest Admin
        </div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block', padding: '10px 12px', borderRadius: '10px',
              color: '#FAF0E6', textDecoration: 'none', fontSize: '14px', fontWeight: 500,
            }}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          style={{
            display: 'block', padding: '10px 12px', borderRadius: '10px', marginTop: 'auto',
            color: 'rgba(250,240,230,0.6)', textDecoration: 'none', fontSize: '13px',
          }}
        >
          ← Voltar ao app
        </Link>
      </aside>
      <main className="flex-1" style={{ padding: 'clamp(20px, 3vw, 40px)', maxWidth: '1100px' }}>
        {children}
      </main>
    </div>
  )
}
