import { z } from 'zod'

// Comissão da Wednest sobre presente de convidado pago pelo app (marketplace_fee no
// Mercado Pago) — min 0 (sem comissão) e max 10 (acordado como teto de negócio).
export const UpdateAppSettingsSchema = z.object({
  platform_fee_percent: z.number().min(0).max(10),
})

export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>
