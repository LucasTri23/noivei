import { z } from 'zod'

// Sem `file_name`: fotos de galeria não precisam de um nome de arquivo visível pro
// usuário (diferente de wedding_files, usado na Central de arquivos).
export const CreateGalleryPhotoSchema = z.object({
  storage_path: z.string().trim().min(1, 'Caminho de armazenamento é obrigatório.').max(1024),
  size_bytes:   z.number().int().positive(),
  mime_type:    z.string().trim().max(255).nullable().optional(),
})

export type CreateGalleryPhotoInput = z.infer<typeof CreateGalleryPhotoSchema>
