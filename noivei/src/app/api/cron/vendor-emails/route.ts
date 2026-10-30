import { err, ok } from '@/lib/api/response'
import { constantTimeEqual } from '@/lib/security/constant-time-compare'
import { deliverVendorEmails } from '@/lib/vendor/deliver-vendor-emails'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = req.headers.get('authorization')
  if (!secret || !authorization || !constantTimeEqual(authorization, 'Bearer ' + secret)) {
    return err(401, 'UNAUTHORIZED', 'Não autorizado.')
  }
  const result = await deliverVendorEmails()
  if (result.failed) return err(503, 'EMAIL_DELIVERY_PENDING', 'Há entregas pendentes para nova tentativa.')
  return ok(result)
}
