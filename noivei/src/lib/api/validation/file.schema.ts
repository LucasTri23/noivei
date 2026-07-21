import { z } from 'zod'

export const CreateWeddingFileSchema = z.object({
  file_name:    z.string().trim().min(1, 'Nome do arquivo é obrigatório.').max(255),
  storage_path: z.string().trim().min(1, 'Caminho de armazenamento é obrigatório.').max(1024),
  size_bytes:   z.number().int().positive(),
  mime_type:    z.string().trim().max(255).nullable().optional(),
})

export type CreateWeddingFileInput = z.infer<typeof CreateWeddingFileSchema>
