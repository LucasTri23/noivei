'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useVendorConversations } from '@/hooks/use-vendor-conversations'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { newUnreadConversations } from '@/lib/vendor/new-chat-messages'
import { toastError, toastSuccess } from '@/store/toast.store'

const NOTIFICATIONS_KEY = 'wednest-vendor-chat-notifications'
function optedIn(): boolean { try { return localStorage.getItem(NOTIFICATIONS_KEY) === 'true' } catch { return false } }
export function VendorNotificationOptIn() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  async function enable() {
    if (!('Notification' in window) || !window.isSecureContext) { toastError('Este navegador não permite notificações. Os avisos dentro do site continuam ativos.'); return }
    if (enabled) { localStorage.removeItem(NOTIFICATIONS_KEY); setEnabled(false); return }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') { localStorage.setItem(NOTIFICATIONS_KEY, 'true'); setEnabled(true); toastSuccess('Notificações ativadas neste navegador enquanto o site estiver aberto.') }
    else toastError('Notificações não autorizadas. Você pode liberá-las nas configurações do navegador.')
  }
  useEffect(() => {
    const timeout = setTimeout(() => setEnabled(optedIn()), 0)
    return () => clearTimeout(timeout)
  }, [])
  return <button type="button" onClick={() => void enable().catch(() => toastError('Não foi possível ativar notificações.'))} style={{ fontSize: 12, color: 'var(--wedding-color-dark)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>{enabled ? 'Desativar notificações' : 'Ativar notificações'}</button>
}

export default function VendorChatNotifications({ as, userId }: { as: 'couple' | 'vendor'; userId: string }) {
  const { data } = useVendorConversations(as)
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const previous = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase.channel('vendor-inbox:' + as + ':' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendor_messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['vendor-conversations'] })
      }).subscribe((status) => { if (status === 'SUBSCRIBED') void queryClient.invalidateQueries({ queryKey: ['vendor-conversations'] }) })
    return () => { void supabase.removeChannel(channel) }
  }, [as, userId, queryClient])
  useEffect(() => {
    if (!data) return
    const snapshot = new Map(data.map((conversation) => [conversation.id, conversation.last_message_at ?? '']))
    if (previous.current) {
      for (const conversation of newUnreadConversations(previous.current, data, userId)) {
        const href = (as === 'couple' ? '/fornecedores/conversas/' : '/fornecedor/conversas/') + conversation.id
        if (document.visibilityState === 'visible' && pathname === href) continue
        if (document.visibilityState === 'visible') toastSuccess('Nova mensagem nas conversas com ' + (as === 'couple' ? 'fornecedores.' : 'casais.'))
        else if ('Notification' in window && Notification.permission === 'granted' && optedIn()) {
          try {
            const notification = new Notification('Nova mensagem no Wednest', { body: 'Você recebeu uma mensagem. Abra suas conversas para ler.', tag: conversation.id })
            notification.onclick = () => { window.focus(); router.push(href); notification.close() }
          } catch { /* Alguns navegadores móveis não suportam Notification sem service worker. */ }
        }
      }
    }
    previous.current = snapshot
  }, [data, userId, as, pathname, router])
  return null
}
