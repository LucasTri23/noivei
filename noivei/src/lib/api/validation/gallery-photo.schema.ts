import { z } from 'zod'

// Sem `file_name`: fotos de galeria não precisam de um nome de arquivo visível pro
// usuário (diferente de wedding_files, usado na Central de arquivos).
export const CreateGalleryPhotoSchema = z.object({
  storage_path: z.string().trim().min(1, 'Caminho de armazenamento é obrigatório.').max(1024),
  size_bytes:   z.number().int().positive(),
  mime_type:    z.string().trim().max(255).nullable().optional(),
})

export type CreateGalleryPhotoInput = z.infer<typeof CreateGalleryPhotoSchema>

// Só os campos de ajuste de recorte são editáveis depois de criada — o resto
// (storage_path, tamanho, mime) é imutável. Exige ao menos um campo pra não aceitar PATCH vazio.
export const UpdateGalleryPhotoSchema = z.object({
  position_y:  z.number().int().min(0).max(100).optional(),
  fit_contain: z.boolean().optional(),
}).refine((data) => data.position_y !== undefined || data.fit_contain !== undefined, {
  message: 'Informe ao menos um campo para atualizar.',
})

export type UpdateGalleryPhotoInput = z.infer<typeof UpdateGalleryPhotoSchema>
