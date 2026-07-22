import { z } from 'zod'

export const SiteSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug deve ter ao menos 3 caracteres.')
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens.')

// Um capítulo narrativo de "Nossa história" (ver `StoryChapter` em lib/site/site-content.ts).
// `content` é um JSONB livre (`z.record`), então validamos essa chave à parte via `.refine`
// abaixo — sem isso, um `story_chapters` malformado passaria batido pelo schema solto.
export const StoryChapterSchema = z.object({
  id:    z.string().min(1),
  title: z.string().trim().min(1, 'Título do capítulo é obrigatório.').max(120),
  body:  z.string().trim().min(1, 'Texto do capítulo é obrigatório.').max(2000),
  date:  z.string().trim().max(60).optional(),
})

export const StoryChaptersSchema = z.array(StoryChapterSchema).max(30, 'No máximo 30 capítulos.')

export const UpdateSiteConfigSchema = z
  .object({
    slug:                 SiteSlugSchema,
    published:            z.boolean(),
    cover_photo_url:      z.url('URL inválida.').nullable(),
    cover_photo_position: z.number().int().min(0).max(100),
    content:              z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')
  .refine((value) => {
    if (!value.content || !('story_chapters' in value.content)) return true
    return StoryChaptersSchema.safeParse(value.content.story_chapters).success
  }, { message: 'Capítulos da história inválidos.', path: ['content', 'story_chapters'] })

export type UpdateSiteConfigInput = z.infer<typeof UpdateSiteConfigSchema>
