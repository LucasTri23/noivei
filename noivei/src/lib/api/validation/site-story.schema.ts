import { z } from 'zod'

import { STORY_LIMITS } from '@/lib/site/story/story-limits'

// Texto opcional: vazio/só espaços vira null (campo limpo), nunca string vazia no banco.
const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null).nullable()

const StoryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number]
    const date = new Date(Date.UTC(year, month - 1, day))
    return year >= 1900 && year <= 2100 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  }, 'Data inválida.')
  .nullable()

const MomentFieldsSchema = z.object({
  title:          optionalText(STORY_LIMITS.titleLength),
  description:    optionalText(STORY_LIMITS.descriptionLength),
  happened_on:    StoryDateSchema,
  date_precision: z.enum(['day', 'month', 'year']),
})

export const CreateStoryMomentSchema = MomentFieldsSchema.partial().extend({
  date_precision: z.enum(['day', 'month', 'year']).default('day'),
})

export const UpdateStoryMomentSchema = MomentFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

// Só formatos que todos os navegadores exibem — o editor converte HEIC/GIF
// (ou recusa) antes do envio; a API confere o tipo real gravado no Storage.
export const STORY_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const DimensionSchema = z.number().int().min(1).max(20000).nullable().optional()

export const CreateStoryPhotoSchema = z.object({
  storage_path: z.string().trim().min(1).max(1024),
  size_bytes:   z.number().int().positive().max(STORY_LIMITS.maxFileBytes),
  mime_type:    z.enum(STORY_PHOTO_MIME_TYPES),
  width:        DimensionSchema,
  height:       DimensionSchema,
  caption:      optionalText(STORY_LIMITS.captionLength).optional(),
  moment_id:    z.uuid().nullable().optional(),
})

export const UpdateStoryPhotoSchema = z
  .object({
    caption:   optionalText(STORY_LIMITS.captionLength),
    moment_id: z.uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const ReorderStorySchema = z.object({
  kind: z.enum(['moments', 'photos']),
  ids:  z.array(z.uuid()).min(1).max(50).refine((ids) => new Set(ids).size === ids.length, 'IDs repetidos.'),
})

export type CreateStoryMomentInput = z.infer<typeof CreateStoryMomentSchema>
export type UpdateStoryMomentInput = z.infer<typeof UpdateStoryMomentSchema>
export type CreateStoryPhotoInput  = z.infer<typeof CreateStoryPhotoSchema>
export type UpdateStoryPhotoInput  = z.infer<typeof UpdateStoryPhotoSchema>
export type ReorderStoryInput      = z.infer<typeof ReorderStorySchema>
