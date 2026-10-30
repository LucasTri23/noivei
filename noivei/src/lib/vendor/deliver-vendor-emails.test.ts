import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/email/send-email', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseService: vi.fn() }))
import { sendEmail } from '@/lib/email/send-email'
import { createSupabaseService } from '@/lib/supabase/service'
import { deliverVendorEmails } from './deliver-vendor-emails'

describe('notificações de solicitação', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    for (const key of ['EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASSWORD', 'EMAIL_FROM', 'VENDOR_ADMIN_EMAIL']) vi.stubEnv(key, 'configured')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')
  })
  function setup() {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const event = { id: '1', vendor_id: 'vendor-1', user_id: 'user-1', business_name: '<script>empresa</script>', status: 'pending_review', reason: null }
    const service = {
      rpc: vi.fn().mockResolvedValue({ data: [{ ...event, recipient: 'admin' }, { ...event, id: '2', recipient: 'vendor' }], error: null }),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'vendor@example.com' } }, error: null }) } },
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) }),
    }
    vi.mocked(createSupabaseService).mockReturnValue(service as never)
    return { service, eq }
  }
  it('envia aos dois destinatários com links distintos e escapa dados da empresa', async () => {
    const { eq } = setup()
    expect(await deliverVendorEmails('vendor-1')).toEqual({ sent: 2, failed: 0 })
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'configured', html: expect.stringContaining('/admin/fornecedores/vendor-1') }))
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'vendor@example.com', html: expect.stringContaining('&lt;script&gt;') }))
    expect(eq).toHaveBeenCalledTimes(2)
  })
  it('não marca como entregue se SMTP falhar e ainda tenta o outro destinatário', async () => {
    const { eq } = setup()
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP indisponível'))
    expect(await deliverVendorEmails()).toEqual({ sent: 1, failed: 1 })
    expect(eq).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
  it('não consome a fila sem configuração SMTP', async () => {
    const { service } = setup()
    vi.stubEnv('EMAIL_SMTP_HOST', '')
    expect((await deliverVendorEmails()).failed).toBe(1)
    expect(service.rpc).not.toHaveBeenCalled()
  })
})
