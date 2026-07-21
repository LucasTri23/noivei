-- Membro com o papel "Noivo(a)" (full_access = true) também pode gerenciar convites.
--
-- Até aqui, ler/criar/revogar convites (wedding_invites) era restrito ao dono LITERAL
-- (weddings.user_id = auth.uid()) — mesmo que um membro convidado tivesse acesso
-- completo ao resto do casamento (fn_has_module_access já trata full_access como
-- equivalente ao dono para os módulos de dado). Essa migration estende a mesma
-- equivalência para a gestão de convites: convidar/revogar deve valer pra quem tem
-- full_access, não só pro dono que criou a conta.
--
-- fn_has_full_access() cobre exatamente essa condição — dono (role = 'owner' em
-- wedding_members, sempre presente graças a fn_add_owner_as_wedding_member) OU
-- membro com permissions->>'full_access' = true. Reaproveitada tanto pelas policies
-- abaixo quanto pelo guard requireWeddingOwnerOrFullAccess (via supabase.rpc), mesmo
-- padrão de fn_has_module_access.
--
-- COALESCE fail-closed (default `false`, não `true`): se `permissions` de algum membro
-- não tiver a chave `full_access` por qualquer motivo (dado legado/malformado), o
-- padrão seguro é negar acesso, não conceder. Na prática isso nunca deveria ocorrer —
-- o convite sempre grava `full_access` explicitamente (default da coluna `wedding_invites.
-- permissions` é `{"full_access": true}`, e o papel restrito grava `false` + `modules`) —
-- mas o fallback correto de uma checagem de permissão é sempre negar, nunca liberar.
--
-- Gestão de MEMBROS (remover pessoa, editar permissões de outra pessoa) continua
-- restrita ao dono literal — não faz parte desta migration, só convites.
CREATE OR REPLACE FUNCTION fn_has_full_access(p_wedding_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wedding_members
    WHERE wedding_id = p_wedding_id
      AND user_id = p_user_id
      AND (role = 'owner' OR COALESCE((permissions->>'full_access')::boolean, false))
  );
$$;

DROP POLICY IF EXISTS "wedding owner can read own invites" ON wedding_invites;
CREATE POLICY "wedding owner or full access member can read invites"
  ON wedding_invites FOR SELECT
  USING (fn_has_full_access(wedding_id, auth.uid()));

DROP POLICY IF EXISTS "wedding owner can create invites" ON wedding_invites;
CREATE POLICY "wedding owner or full access member can create invites"
  ON wedding_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND fn_has_full_access(wedding_id, auth.uid())
  );

DROP POLICY IF EXISTS "wedding owner can revoke own invites" ON wedding_invites;
CREATE POLICY "wedding owner or full access member can revoke invites"
  ON wedding_invites FOR UPDATE
  USING (fn_has_full_access(wedding_id, auth.uid()));
