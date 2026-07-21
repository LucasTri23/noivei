import { z } from 'zod'

export const CreateWeddingPartyEntrySchema = z.object({
  guest_id:             z.uuid(),
  role:                 z.string().trim().min(1, 'Informe o papel no cortejo.').max(60),
  carries_rings:        z.boolean().optional(),
  paired_with_entry_id: z.uuid().nullable().optional(),
})

export const UpdateWeddingPartyEntrySchema = z
  .object({
    role:                 z.string().trim().min(1, 'Informe o papel no cortejo.').max(60),
    carries_rings:        z.boolean(),
    paired_with_entry_id: z.uuid().nullable(),
    sort_order:           z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreateWeddingPartyEntryInput = z.infer<typeof CreateWeddingPartyEntrySchema>
export type UpdateWeddingPartyEntryInput = z.infer<typeof UpdateWeddingPartyEntrySchema>
