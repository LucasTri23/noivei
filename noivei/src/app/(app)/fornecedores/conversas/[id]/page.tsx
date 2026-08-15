import { notFound, redirect } from 'next/navigation'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import VendorMessageThread from '@/components/vendors/chat/vendor-message-thread'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'

interface ConversaPageProps {
  params: Promise<{ id: string }>
}

// Reaproveita fn_list_vendor_conversations (mesma RPC do GET /api/v1/vendor-
// conversations) em vez de um SELECT direto em vendor_profiles pro nome do
// fornecedor: essa function já resolve corretamente mesmo se o fornecedor não
// estiver mais publicamente visível (pausado/suspenso após a conversa começar) —
// um SELECT direto em vendor_profiles pelo client do casal dependeria da policy
// pública (fn_vendor_is_publicly_visible), que para de valer nesse caso. A RPC
// também já É a checagem de posse (só devolve linhas de conversas que este
// usuário pode acessar) — se o id não aparecer no resultado, ou a conversa não
// existe ou não é sua, mesmo 404 genérico pros dois casos.
async function ConversaContent({ params }: ConversaPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.rpc('fn_list_vendor_conversations')
  const conversation = ((data ?? []) as VendorConversationListItem[]).find((item) => item.id === id)

  if (!conversation) notFound()

  return (
    <div style={{ height: 'calc(100vh - 260px)', minHeight: '460px' }}>
      <VendorMessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        otherPartyName={conversation.vendor_business_name}
        backHref="/fornecedores/conversas"
      />
    </div>
  )
}

export default function ConversaPage(props: ConversaPageProps) {
  return (
    <ModuleAccessGate module="fornecedores">
      <ConversaContent {...props} />
    </ModuleAccessGate>
  )
}
