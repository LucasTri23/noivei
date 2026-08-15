import { z } from 'zod'

export const CreateVendorConversationSchema = z.object({
  vendor_id: z.uuid(),
})
export type CreateVendorConversationInput = z.infer<typeof CreateVendorConversationSchema>

// sender_user_id NUNCA aparece aqui de propósito — é sempre auth.uid() no servidor
// (ver comentário na migration 20260806000004: a RLS já impede um sender_user_id
// forjado de forma independente, mas o contrato da API é nem aceitar o campo).
// Limite de 4000 caracteres: generoso pro que uma mensagem de chat real precisa
// (um orçamento detalhado de fornecedor cabe folgado), mas impede alguém colar um
// texto gigante pra abusar de armazenamento/render no thread do outro lado.
export const SendVendorMessageSchema = z.object({
  body: z.string().trim().min(1, 'A mensagem não pode ficar vazia.').max(4000, 'Mensagem muito longa (máximo de 4000 caracteres).'),
})
export type SendVendorMessageInput = z.infer<typeof SendVendorMessageSchema>
