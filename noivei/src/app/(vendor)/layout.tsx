import VendorChatNotifications from '@/components/vendors/chat/vendor-chat-notifications'
import { headers } from 'next/headers'
import { requireAccountType } from '@/lib/auth/account-type'
import { ApiError } from '@/lib/api/response'
import { redirect } from 'next/navigation'
import VendorTopBar from '@/components/layout/vendor-top-bar'
import { createSupabaseServer } from '@/lib/supabase/server'

// Área exclusiva de contas de fornecedor, independente dos módulos de casamento.
export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/fornecedor')
  try { await requireAccountType(supabase, 'vendor') }
  catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_TYPE_CONFLICT') redirect('/dashboard')
    throw error
  }

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
      {approved && <VendorChatNotifications as="vendor" userId={user.id} />}
      <VendorTopBar approved={approved} businessName={vendorProfile?.business_name ?? null} hasUnreadVendorMessages={hasUnreadVendorMessages} />
      <main style={{ padding: 'clamp(20px, 3.5vw, 44px)', paddingBottom: '64px', maxWidth: '760px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
