import { redirect } from 'next/navigation'
import VendorConversationsList from '@/components/vendors/chat/vendor-conversations-list'
import { createSupabaseServer } from '@/lib/supabase/server'

// (vendor)/layout.tsx já garante autenticação + perfil de fornecedor existente
// antes de renderizar qualquer página deste grupo — auth.getUser() aqui é só pra
// ter o user.id (currentUserId da lista), mesma redundância intencional de
// ModuleAccessGate no lado do casal.
export default async function FornecedorConversasPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,4vw,34px)', lineHeight: 1.1, color: 'var(--fg)' }}>
          Conversas
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          Mensagens de casais interessados no seu trabalho.
        </p>
      </div>

      <VendorConversationsList
        as="vendor"
        basePath="/fornecedor/conversas"
        currentUserId={user.id}
        emptyTitle="Nenhuma conversa ainda"
        emptyBody="Quando um casal iniciar uma conversa pelo seu perfil no marketplace, ela aparece aqui."
      />
    </div>
  )
}
