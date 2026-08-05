import { z } from 'zod'

// Comissão da Wednest sobre presente de convidado pago pelo app (marketplace_fee no
// Mercado Pago) — min 0 (sem comissão) e max 10 (acordado como teto de negócio).
//
// account_purge_days: dias entre soft-delete de conta e expurgo definitivo (Storage +
// banco, ver cron/purge-accounts) — min 7 (nunca instantâneo demais) e max 365 (teto de
// bom senso), mesmo CHECK da coluna em app_settings. O formulário do admin sempre manda
// os dois campos juntos no mesmo PATCH (ver admin-settings-manager.tsx), então ambos
// seguem obrigatórios aqui, sem .partial().
export const UpdateAppSettingsSchema = z.object({
  platform_fee_percent: z.number().min(0).max(10),
  account_purge_days:   z.number().int().min(7).max(365),
})

export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>
