import { z } from 'zod'

// Token de convite é um UUID serializado como texto (wedding_invites.token)
export const InviteTokenSchema = z.string().trim().min(1)

export const AcceptInviteSchema = z.object({ token: InviteTokenSchema })

// Body opcional do accept — só é enviado na segunda tentativa, depois que o usuário
// confirma que quer sair do casamento atual (ver ALREADY_IN_ANOTHER_WEDDING).
export const AcceptInviteBodySchema = z
  .object({ confirm_leave_current_wedding: z.boolean() })
  .partial()

// Mesmas chaves de WeddingModuleKey em src/types/database.ts — repetido aqui (não
// importado) porque schemas de validação do projeto não dependem de types/database,
// só o contrário; mantenha as duas listas em sincronia se um módulo for adicionado.
export const WEDDING_MODULE_KEYS = [
  'checklist', 'convidados', 'financeiro', 'mesas', 'site', 'arquivos', 'presentes', 'padrinhos',
] as const

export const WeddingMemberPermissionsSchema = z.object({
  full_access: z.boolean(),
  modules:     z.record(z.enum(WEDDING_MODULE_KEYS), z.boolean()).optional(),
})

// Convite sem body = full_access (comportamento de hoje, "Noivo/Noiva"); com body,
// o dono escolheu um papel restrito e mandou o conjunto de módulos liberados.
export const CreateInviteSchema = z
  .object({ permissions: WeddingMemberPermissionsSchema })
  .partial()

export type AcceptInviteInput   = z.infer<typeof AcceptInviteSchema>
export type AcceptInviteBodyInput = z.infer<typeof AcceptInviteBodySchema>
export type CreateInviteInput   = z.infer<typeof CreateInviteSchema>
