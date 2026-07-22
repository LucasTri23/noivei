-- Bug real encontrado em produção: criar um casamento (INSERT ... RETURNING id, feito
-- no onboarding) falhava com "new row violates row-level security policy for table
-- weddings" (42501), mesmo com JWT válido e a policy de INSERT correta.
--
-- Causa: trg_weddings_add_owner_member (AFTER INSERT ON weddings, ver migration
-- 20260703000011) cria a linha em wedding_members DEPOIS do INSERT. Mas a policy de
-- SELECT de weddings foi trocada, nessa mesma migration, de "auth.uid() = user_id"
-- direto para fn_is_wedding_member(id, auth.uid()) — que depende dessa linha de
-- wedding_members. RETURNING precisa que a linha recém-inserida passe pela policy de
-- SELECT para ser devolvida ao client, e nesse instante a policy baseada em
-- membership falha (só o INSERT ... RETURNING é afetado — qualquer outro
-- INSERT/UPDATE do app é em tabela filha de um casamento onde o usuário já é membro
-- ANTES da operação, nunca esbarra nisso).
--
-- Correção: dono sempre pode ler o próprio casamento por user_id diretamente, além de
-- poder por ser membro — mais correto semanticamente (dono nunca deveria depender de
-- uma linha auxiliar pra ver o próprio casamento) e resolve o problema de
-- ordem/visibilidade da trigger no RETURNING.

DROP POLICY "members can read their wedding" ON weddings;
CREATE POLICY "owner or members can read wedding"
  ON weddings FOR SELECT
  USING ((auth.uid() = user_id OR fn_is_wedding_member(id, auth.uid())) AND deleted_at IS NULL);

DROP POLICY "members can update their wedding" ON weddings;
CREATE POLICY "owner or members can update wedding"
  ON weddings FOR UPDATE
  USING ((auth.uid() = user_id OR fn_is_wedding_member(id, auth.uid())) AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id OR fn_is_wedding_member(id, auth.uid()));
