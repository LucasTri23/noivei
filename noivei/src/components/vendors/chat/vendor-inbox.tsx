'use client'
import VendorConversationsList from './vendor-conversations-list'
import VendorMessageThread from './vendor-message-thread'
import { VendorNotificationOptIn } from './vendor-chat-notifications'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'
export default function VendorInbox({ as, currentUserId, selected }: { as: 'couple' | 'vendor'; currentUserId: string; selected?: VendorConversationListItem }) {
  const basePath = as === 'couple' ? '/fornecedores/conversas' : '/fornecedor/conversas'
  return <div className="grid md:grid-cols-[minmax(250px,340px)_minmax(0,1fr)]" style={{ height: 'min(72vh,760px)', minHeight: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
    <aside className={selected ? 'hidden md:flex md:flex-col' : 'flex flex-col'} style={{ minWidth: 0, minHeight: 0, borderRight: '1px solid var(--border)' }}>
      <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}><h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Conversas</h2><VendorNotificationOptIn /></div>
      <div style={{ overflowY: 'auto', flex: 1 }}><VendorConversationsList as={as} basePath={basePath} currentUserId={currentUserId} activeId={selected?.id} emptyTitle="Nenhuma conversa ainda" emptyBody={as === 'couple' ? 'Inicie uma conversa pelo perfil de um fornecedor.' : 'As mensagens dos casais aparecerão aqui.'} /></div>
    </aside>
    <div className={selected ? 'block' : 'hidden md:flex md:items-center md:justify-center'} style={{ minWidth: 0, minHeight: 0, padding: selected ? 20 : 36, background: 'var(--bg)' }}>
      {selected ? <VendorMessageThread key={selected.id} conversationId={selected.id} currentUserId={currentUserId} otherPartyName={as === 'couple' ? selected.vendor_business_name : selected.wedding_couple_names} avatarUrl={as === 'couple' ? '/api/v1/vendors/' + selected.vendor_slug + '/avatar' : undefined} backHref={basePath} /> : <div style={{ textAlign: 'center', color: 'var(--muted-fg)', maxWidth: 340 }}><p className="font-display" style={{ fontSize: 30, color: 'var(--wedding-color-dark)', marginBottom: 14 }}>Tudo em uma conversa.</p><p>Selecione um contato ao lado para acompanhar orçamentos, combinar detalhes e trocar mensagens.</p></div>}
    </div>
  </div>
}
