import { redirect } from 'next/navigation'
import VendorInbox from '@/components/vendors/chat/vendor-inbox'
import { createSupabaseServer } from '@/lib/supabase/server'
import ModuleAccessGate from '@/components/billing/module-access-gate'

async function Content() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <VendorInbox as="couple" currentUserId={user.id} />
}
export default function ConversationsPage() { return <ModuleAccessGate module="fornecedores"><Content /></ModuleAccessGate> }
