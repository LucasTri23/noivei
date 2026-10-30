import { sendEmail } from '@/lib/email/send-email'
import { emailLayout } from '@/lib/email/templates/email-layout'
import { createSupabaseService } from '@/lib/supabase/service'

interface VendorEmail {
  id: string
  vendor_id: string
  user_id: string
  business_name: string
  status: string
  reason: string | null
  recipient: 'admin' | 'vendor'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

const messages: Record<string, [string, string]> = {
  pending_review: ['Solicitação recebida', 'O cadastro foi enviado para análise. Aguarde a aprovação do administrador para usar o painel completo.'],
  active: ['Cadastro aprovado', 'O perfil foi aprovado. Para aparecer no marketplace, é necessário também ter uma assinatura ativa e válida.'],
  rejected: ['Solicitação não aprovada', 'Revise os dados e reenvie a solicitação pelo cadastro.'],
  suspended: ['Perfil suspenso', 'O acesso ao painel completo está suspenso. Entre em contato com o suporte.'],
  paused: ['Perfil pausado', 'O perfil está pausado e não aparece no marketplace.'],
}

/** Falhas não desfazem a decisão; a fila fica pendente para nova tentativa. */
export async function deliverVendorEmails(vendorId?: string): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  try {
    for (const key of ['EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASSWORD', 'EMAIL_FROM', 'VENDOR_ADMIN_EMAIL', 'NEXT_PUBLIC_APP_URL']) {
      if (!process.env[key]) throw new Error('Configure ' + key + ' para enviar os e-mails de fornecedores.')
    }
    const supabase = createSupabaseService()
    const { data, error } = await supabase.rpc('fn_claim_vendor_emails', { p_vendor_id: vendorId ?? null })
    if (error) throw error
    for (const event of (data ?? []) as VendorEmail[]) {
      try {
        let to = process.env.VENDOR_ADMIN_EMAIL!
        if (event.recipient === 'vendor') {
          const { data: account, error: accountError } = await supabase.auth.admin.getUserById(event.user_id)
          if (accountError || !account.user?.email) throw new Error('Conta do fornecedor sem e-mail disponível.')
          to = account.user.email
        }
        const copy = messages[event.status]
        if (!copy) throw new Error('Status de notificação desconhecido.')
        const [title, message] = copy
        const admin = event.recipient === 'admin'
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '')
        const html = emailLayout({
          title,
          bodyHtml: '<p><strong>' + escapeHtml(event.business_name) + '</strong></p><p>' + message + '</p>' +
            (event.reason ? '<p>Motivo: ' + escapeHtml(event.reason) + '</p>' : '') +
            (admin && event.status === 'pending_review' ? '<p>Uma solicitação aguarda sua análise.</p>' : ''),
          ctaLabel: admin ? 'Ver solicitação' : 'Acompanhar cadastro',
          ctaUrl: baseUrl + (admin ? '/admin/fornecedores/' + event.vendor_id : '/fornecedor'),
        })
        await sendEmail({ to, subject: '[Wednest] ' + title, html })
        const { error: updateError } = await supabase.from('vendor_email_outbox').update({ sent_at: new Date().toISOString() }).eq('id', event.id)
        if (updateError) throw updateError
        sent++
      } catch (error) {
        failed++
        console.error('[vendor-email] Entrega pendente:', event.id, error)
      }
    }
  } catch (error) {
    failed++
    console.error('[vendor-email] Fila indisponível:', error)
  }
  return { sent, failed }
}
