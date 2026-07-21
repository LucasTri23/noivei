import type { SupabaseClient } from '@supabase/supabase-js'

import type { WeddingMemberPermissions, WeddingModuleKey } from '@/types/database'

export interface UserWedding {
  id:          string
  role:        'owner' | 'member'
  isOwner:     boolean
  permissions: WeddingMemberPermissions
}

/**
 * Resolve o casamento do usuário logado — dono OU membro convidado (ver
 * wedding_members/"juntar contas"). Substitui o antigo padrão
 * `weddings.eq('user_id', user.id)`, que só encontrava o casamento do dono e
 * deixava um membro convidado sem acesso a nada (RLS já bloqueia isso hoje,
 * mas a query nem encontrava a linha pra começar).
 *
 * Cada conta só pode ser DONA de um casamento, mas pode ser MEMBRO de no
 * máximo um também (mesma UNIQUE (wedding_id, user_id) não impede múltiplos
 * casamentos por user_id na tabela — a regra de "1 por conta" é de produto,
 * não de schema; `.limit(1)` aqui reflete essa regra de produto, igual ao
 * resto do código já fazia antes desta função existir).
 */
export async function getUserWedding(
  supabase: SupabaseClient,
  userId:   string,
): Promise<UserWedding | null> {
  const { data, error } = await supabase
    .from('wedding_members')
    .select('wedding_id, role, permissions, weddings!inner(deleted_at)')
    .eq('user_id', userId)
    .is('weddings.deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const role = data.role as 'owner' | 'member'
  return {
    id:          data.wedding_id as string,
    role,
    isOwner:     role === 'owner',
    permissions: (data.permissions as WeddingMemberPermissions | null) ?? { full_access: true },
  }
}

/**
 * Confere se `permissions` libera o módulo `module` — espelha exatamente a lógica
 * de fn_has_module_access() no banco (dono/full_access sempre passa; senão, olha
 * o módulo específico). Uso em código (UI, guards de API) para não duplicar a
 * regra com sintaxe diferente da RLS.
 */
export function hasModuleAccess(wedding: UserWedding, module: WeddingModuleKey): boolean {
  if (wedding.isOwner) return true
  if (wedding.permissions.full_access) return true
  return wedding.permissions.modules?.[module] === true
}
