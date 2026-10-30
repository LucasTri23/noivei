import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import VendorTopBar from '@/components/layout/vendor-top-bar'
import { createSupabaseServer } from '@/lib/supabase/server'

// Grupo de rotas da área do PRÓPRIO fornecedor (/fornecedor, /fornecedor/cadastro) —
// de propósito FORA de (app): src/app/(app)/layout.tsx força redirect pra
// /onboarding quando a conta não tem nenhuma linha em `weddings`, e uma conta
// 100% fornecedor (sem casamento nenhum) precisa conseguir usar esta área. Uma
// conta híbrida (casamento E fornecedor) também não deve ser barrada aqui por
// nenhuma lógica de casamento — por isso este layout nunca chama
// getUserWedding()/checa módulo de casamento, só autenticação + existência de
// vendor_profiles.
export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: vendorProfile } = await supabase
    .from('vendor_profiles')
    .select('id, business_name, status')
    .eq('user_id', user.id)
    .maybeSingle()

  // Conta autenticada sem NENHUM perfil de fornecedor ainda — manda pro início do
  // cadastro, exceto se já for essa a rota (senão vira loop de redirect: a própria
  // página do wizard também não tem perfil até completar o Passo 1). x-pathname é
  // setado pelo middleware (ver src/middleware.ts) — Server Component de layout não
  // tem acesso nativo ao pathname da requisição.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const isOnCadastroRoute = pathname === '/fornecedor/cadastro' || pathname.startsWith('/fornecedor/cadastro/')

  if (!vendorProfile && !isOnCadastroRoute) redirect('/fornecedor/cadastro')
  const approved = vendorProfile?.status === 'active' || vendorProfile?.status === 'paused'
  const isStatusRoute = pathname === '/fornecedor' || pathname === '/fornecedor/'
  const isProfileRoute = pathname === '/fornecedor/perfil'
  if (vendorProfile && !approved && !isStatusRoute && !isOnCadastroRoute && !isProfileRoute) redirect('/fornecedor')

  // Sem perfil de fornecedor ainda (rota de cadastro), pula a RPC — sem
  // vendor_profiles.user_id = auth.uid() pra casar, fn_list_vendor_conversations
  // sempre voltaria vazia mesmo, mas não vale o round-trip no caminho do wizard.
  let hasUnreadVendorMessages = false
  if (vendorProfile && approved) {
    const { data: conversationRows } = await supabase.rpc('fn_list_vendor_conversations')
    hasUnreadVendorMessages = ((conversationRows ?? []) as { unread_count: number }[])
      .some((row) => row.unread_count > 0)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--fg)' }}>
      <VendorTopBar approved={approved} businessName={vendorProfile?.business_name ?? null} hasUnreadVendorMessages={hasUnreadVendorMessages} />
      <main style={{ padding: 'clamp(20px, 3.5vw, 44px)', paddingBottom: '64px', maxWidth: '760px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
