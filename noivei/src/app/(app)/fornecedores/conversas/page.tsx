import { redirect } from 'next/navigation'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import VendorConversationsList from '@/components/vendors/chat/vendor-conversations-list'
import { createSupabaseServer } from '@/lib/supabase/server'

// Mesmo formato de página de src/app/(app)/fornecedores/page.tsx: wrapper síncrono
// com ModuleAccessGate em volta de um Content async — 'fornecedores' nunca leva
// PaywallGate (decisão de produto já tomada na Fase 1/3), só o gate de permissão
// de módulo.
async function ConversasContent() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          Conversas
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          Suas conversas com fornecedores do marketplace.
        </p>
      </div>

      <VendorConversationsList
        as="couple"
        basePath="/fornecedores/conversas"
        currentUserId={user.id}
        emptyTitle="Nenhuma conversa ainda"
        emptyBody="Quando você conversar com um fornecedor pelo marketplace, a conversa aparece aqui."
      />
    </div>
  )
}

export default function ConversasPage() {
  return (
    <ModuleAccessGate module="fornecedores">
      <ConversasContent />
    </ModuleAccessGate>
  )
}
