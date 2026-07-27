import { parseJsonBody } from '@/lib/api/parse-body'
import { ok, err, handleApiError } from '@/lib/api/response'
import { GuestGiftCheckoutSchema } from '@/lib/api/validation/gift.schema'
import { getValidMpAccountAccessToken } from '@/lib/gifts/wedding-mp-account'
import { createOneTimeCheckout } from '@/lib/integrations/payment/mercadopago'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createSupabaseService } from '@/lib/supabase/service'

// Rota pública — quem paga é um convidado anônimo, sem conta/sessão nenhuma no
// Wednest. O dinheiro cai direto na conta do CASAL (token OAuth conectado em
// gift-payments/connect), com a comissão da Wednest retida via marketplace_fee —
// nunca passa pela conta da própria Wednest. Ver 20260727000002 pro desenho completo.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createSupabaseService()
    const { id: giftId } = await params

    // Sem sessão pra limitar por usuário — só por IP, contra bot/spam criando
    // preferências de pagamento à toa na conta do casal.
    const ipLimit = await checkRateLimit(supabase, `gift-checkout:ip:${getClientIp(req)}`, 20, 3600)
    if (!ipLimit.allowed) return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')

    const body = await parseJsonBody(req)
    const parsed = GuestGiftCheckoutSchema.safeParse(body)
    if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

    const { data: gift, error: giftError } = await supabase
      .from('gift_registry_items')
      .select('id, wedding_id, name, price_cents, gift_type, is_purchased')
      .eq('id', giftId)
      .maybeSingle()

    if (giftError) return err(500, 'DB_ERROR', 'Erro ao buscar o presente.')
    if (!gift || gift.gift_type !== 'app_payment' || gift.is_purchased || !gift.price_cents) {
      return err(404, 'GIFT_NOT_AVAILABLE', 'Este presente não está disponível para pagamento pelo app.')
    }

    const weddingId = gift.wedding_id as string

    const accessToken = await getValidMpAccountAccessToken(supabase, weddingId)
    if (!accessToken) {
      return err(400, 'MP_NOT_CONNECTED', 'O casal ainda não conectou uma conta para receber presentes pelo app.')
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('platform_fee_percent')
      .eq('id', true)
      .maybeSingle()
    // Number(...) por segurança: NUMERIC do Postgres às vezes vem serializado como
    // string via PostgREST dependendo da configuração — nunca confiar que já é number.
    const feePercent = Number(settings?.platform_fee_percent ?? 5)

    const priceCents = gift.price_cents as number
    const applicationFeeCents = Math.round(priceCents * (feePercent / 100))

    const { data: site } = await supabase
      .from('site_config')
      .select('slug')
      .eq('wedding_id', weddingId)
      .eq('published', true)
      .maybeSingle()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const backBase = site?.slug ? `${appUrl}/${site.slug}` : appUrl
    const mpReference = crypto.randomUUID()

    const { data: checkout, error: checkoutError } = await supabase
      .from('gift_payment_checkouts')
      .insert({
        gift_id:             giftId,
        wedding_id:          weddingId,
        guest_name:          parsed.data.guest_name || null,
        amount_brl:          priceCents,
        application_fee_brl: applicationFeeCents,
        mp_reference:        mpReference,
      })
      .select('id')
      .single()

    if (checkoutError || !checkout) return err(500, 'DB_ERROR', 'Erro ao iniciar o checkout.')

    try {
      const result = await createOneTimeCheckout({
        itemTitle:          gift.name as string,
        amountBrl:          priceCents / 100,
        externalReference:  mpReference,
        successUrl:         `${backBase}?presente=sucesso`,
        failureUrl:         `${backBase}?presente=falha`,
        pendingUrl:         `${backBase}?presente=pendente`,
        notificationUrl:    `${appUrl}/api/v1/webhooks/mercadopago-gifts`,
        accessToken,
        marketplaceFeeBrl:  applicationFeeCents / 100,
      })

      await supabase.from('gift_payment_checkouts').update({ mp_preference_id: result.id }).eq('id', checkout.id)

      return ok({ redirect_url: result.redirectUrl })
    } catch (mpError) {
      console.error('[gifts/checkout] erro ao criar checkout no Mercado Pago:', mpError)
      await supabase.from('gift_payment_checkouts').update({ status: 'rejected' }).eq('id', checkout.id)
      return err(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.')
    }
  } catch (error) {
    return handleApiError(error)
  }
}
