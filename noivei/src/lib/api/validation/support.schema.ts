import { z } from 'zod'

export const SupportContactSchema = z.object({
  subject: z.string().trim().min(3, 'Escreva um título com pelo menos 3 caracteres.').max(150, 'Título muito longo.'),
  message: z.string().trim().min(10, 'Conte um pouco mais — pelo menos 10 caracteres.').max(4000, 'Mensagem muito longa.'),
})

export type SupportContactInput = z.infer<typeof SupportContactSchema>
