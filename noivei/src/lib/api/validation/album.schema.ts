import { z } from 'zod'

import { SiteSlugSchema } from '@/lib/api/validation/site.schema'

// O identificador público do mural é o MESMO slug do site do casal
// (site_config.slug, ver SiteSlugSchema) — não existe mais um token próprio
// (weddings.album_token foi removido, ver migration 20260803000001).
export const AlbumSlugSchema = SiteSlugSchema

// Mesmo formato frouxo de telefone do RSVP público (PhoneSchema em rsvp.schema.ts)
// — aceita formatos brasileiros comuns, sem validar internacionalização.
const AlbumPhoneSchema = z
  .string()
  .trim()
  .min(8, 'Telefone inválido.')
  .max(20, 'Telefone inválido.')
  .regex(/^[\d\s()+-]+$/, 'Telefone inválido.')

export const RegisterContributorSchema = z.object({
  name:         z.string().trim().min(1, 'Nome é obrigatório.').max(120),
  relationship: z.string().trim().min(1, 'Informe sua relação com o casal.').max(120),
  phone:        AlbumPhoneSchema,
})

export type RegisterContributorInput = z.infer<typeof RegisterContributorSchema>
