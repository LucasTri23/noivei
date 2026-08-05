import { z } from 'zod'

// Únicos 2 valores aceitos pelo CHECK constraint de wedding_files.category (migration
// 20260805000013) — mantém o Zod e o banco em sincronia manualmente, já que não há
// geração automática de tipos a partir do schema SQL neste projeto (ver types/database.ts).
export const WeddingFileCategorySchema = z.enum(['geral', 'contrato'])

export const CreateWeddingFileSchema = z.object({
  file_name:    z.string().trim().min(1, 'Nome do arquivo é obrigatório.').max(255),
  storage_path: z.string().trim().min(1, 'Caminho de armazenamento é obrigatório.').max(1024),
  size_bytes:   z.number().int().positive(),
  mime_type:    z.string().trim().max(255).nullable().optional(),
  category:     WeddingFileCategorySchema.default('geral'),
})

export type CreateWeddingFileInput = z.infer<typeof CreateWeddingFileSchema>
