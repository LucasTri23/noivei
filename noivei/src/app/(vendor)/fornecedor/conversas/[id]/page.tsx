import { notFound, redirect } from 'next/navigation'
import VendorMessageThread from '@/components/vendors/chat/vendor-message-thread'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'

interface ConversaPageProps {
  params: Promise<{ id: string }>
}

// Mesma RPC/raciocínio do lado do casal (ver o [id]/page.tsx equivalente em
// (app)/fornecedores/conversas): fn_list_vendor_conversations já é a checagem de
// posse (só devolve conversas que ESTE fornecedor participa) e resolve
// couple_names mesmo sem o fornecedor ter nenhuma outra forma de ler `weddings`.
export default async function FornecedorConversaPage({ params }: ConversaPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.rpc('fn_list_vendor_conversations')
  const conversation = ((data ?? []) as VendorConversationListItem[]).find((item) => item.id === id)

  if (!conversation) notFound()

  return (
    <div style={{ height: 'calc(100vh - 220px)', minHeight: '460px' }}>
      <VendorMessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        otherPartyName={conversation.wedding_couple_names}
        backHref="/fornecedor/conversas"
      />
    </div>
  )
}
