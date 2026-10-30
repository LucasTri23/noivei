import { redirect } from 'next/navigation'
import VendorInbox from '@/components/vendors/chat/vendor-inbox'
import { createSupabaseServer } from '@/lib/supabase/server'

async function Content() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <VendorInbox as="vendor" currentUserId={user.id} />
}
export default function ConversationsPage() { return <Content /> }
