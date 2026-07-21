-- A tela de gestão de membros ("Juntar contas", ver 20260703000011) precisa mostrar o
-- nome de cada membro do casamento. `profiles` só permite "users can read own profile"
-- (auth.uid() = id) — sem esta policy, o dono nunca conseguiria ler o full_name de
-- ninguém além de si mesmo, e a lista de membros ficaria sem nome.
--
-- Mesmo padrão já usado na migration anterior para `subscriptions` (members can read
-- their wedding owner's subscription): adiciona uma policy de SELECT (não substitui as
-- existentes — policies do mesmo comando são combinadas com OR pelo Postgres), restrita
-- a quem compartilha uma linha em wedding_members com o alvo — ou seja, só quem já é
-- membro do MESMO casamento enxerga o nome de quem também é.
CREATE POLICY "members can read profiles of fellow wedding members"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wedding_members wm_self
      JOIN wedding_members wm_target
        ON wm_target.wedding_id = wm_self.wedding_id
      WHERE wm_self.user_id = auth.uid()
        AND wm_target.user_id = profiles.id
    )
  );
