import { notFound, redirect } from 'next/navigation'
import VendorInbox from '@/components/vendors/chat/vendor-inbox'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'

interface Props { params: Promise<{ id: string }> }
async function Content({ params }: Props) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await supabase.rpc('fn_list_vendor_conversations')
  const selected = ((data ?? []) as VendorConversationListItem[]).find((conversation) => conversation.id === id && conversation.viewer_role === 'vendor')
  if (!selected) notFound()
  return <VendorInbox as="vendor" currentUserId={user.id} selected={selected} />
}
export default function ConversationPage(props: Props) { return <Content {...props} /> }
