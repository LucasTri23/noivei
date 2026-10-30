'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useVendorConversations } from '@/hooks/use-vendor-conversations'
export default function VendorMarketplaceTabs() {
  const pathname = usePathname()
  const { data } = useVendorConversations('couple')
  const unread = data?.reduce((sum, conversation) => sum + conversation.unread_count, 0) ?? 0
  return <nav aria-label="Área de fornecedores" style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
    {[['/fornecedores', 'Buscar fornecedores'], ['/fornecedores/conversas', 'Conversas']].map(([href, label]) => {
      const active = href === '/fornecedores' ? pathname === href : pathname.startsWith(href!)
      return <Link key={href} href={href!} aria-current={active ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', fontSize: 14, fontWeight: 600, borderRadius: 10, color: active ? 'var(--wedding-color-dark)' : 'var(--muted-fg)', background: active ? 'var(--wedding-color-subtle)' : 'transparent' }}>{label}{href?.endsWith('conversas') && unread > 0 && <span aria-label={unread + ' mensagens não lidas'} style={{ color: '#fff', background: 'var(--wedding-color-dark)', fontSize: 11, borderRadius: 99, padding: '2px 7px' }}>{unread > 99 ? '99+' : unread}</span>}</Link>
    })}
  </nav>
}
