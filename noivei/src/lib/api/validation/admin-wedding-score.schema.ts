import { z } from 'zod'

// Mesma lista fixa do CHECK de wedding_score_module_weights (migration
// 20260805000008) — os 7 módulos que compõem o Wedding Score são um conjunto
// fechado, igual ao WeddingModuleKeySchema.
export const WeddingScoreModuleKeySchema = z.enum([
  'checklist', 'financeiro', 'convidados', 'rsvp', 'mesas', 'presentes', 'arquivos',
])

export const WeddingScoreModuleWeightInputSchema = z.object({
  module_key: WeddingScoreModuleKeySchema,
  // Sem teto de "soma 100" de propósito — o cálculo normaliza pela soma real dos
  // pesos (ver calculator.ts), então qualquer valor >= 0 é válido isoladamente.
  // 1000 é só um teto de bom senso contra erro de digitação (ex: perder uma vírgula).
  weight: z.number().min(0).max(1000),
})

// O formulário sempre manda os 7 módulos juntos (mesmo espírito de
// UpdateAppSettingsSchema, que não usa .partial()) — o admin edita a tela toda de
// uma vez, não módulo a módulo.
export const UpdateWeddingScoreConfigSchema = z.object({
  enabled:           z.boolean(),
  title:             z.string().trim().min(1).max(120),
  description:       z.string().trim().min(1).max(300),
  label_low:         z.string().trim().min(1).max(80),
  description_low:   z.string().trim().min(1).max(300),
  label_mid:         z.string().trim().min(1).max(80),
  description_mid:   z.string().trim().min(1).max(300),
  label_high:        z.string().trim().min(1).max(80),
  description_high:  z.string().trim().min(1).max(300),
  weights:           z.array(WeddingScoreModuleWeightInputSchema).length(7),
})

export type UpdateWeddingScoreConfigInput = z.infer<typeof UpdateWeddingScoreConfigSchema>
