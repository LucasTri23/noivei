-- Acesso compartilhado ao casamento ("juntar contas").
--
-- Até aqui, só o dono (weddings.user_id) tinha qualquer acesso aos dados do
-- casamento — toda RLS de tabela filha checava `w.user_id = auth.uid()` direto.
-- Os planos pagos prometem múltiplos usuários por casamento (Premium até 5,
-- Premium Plus até 10 — ver a tabela de comparação em plan-selector.tsx), mas não
-- existia nenhum mecanismo de convite/membro — essa promessa nunca foi cumprida.
--
-- Esta migration introduz:
--   - wedding_members: quem tem acesso a um casamento (dono + convidados que aceitaram)
--   - wedding_invites: links de convite com token, expiráveis, de uso único
--   - fn_is_wedding_member(): substitui o EXISTS repetido em toda RLS do projeto —
--     dono e membros passam a ter o MESMO acesso aos dados do casamento (checklist,
--     convidados, financeiro, arquivos, site etc.). Só a gestão de membros/convites
--     e ações de conta (billing, exclusão) continuam restritas ao dono.
--
-- Toda RLS de tabela filha de weddings criada nas migrations anteriores é recriada
-- aqui trocando o EXISTS direto em weddings.user_id por fn_is_wedding_member —
-- mesmo padrão de acesso, só que via associação em vez de posse direta.

-- =========================================================
-- wedding_members
-- =========================================================
CREATE TABLE wedding_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedding_id, user_id)
);

CREATE INDEX idx_wedding_members_wedding_id ON wedding_members(wedding_id);
CREATE INDEX idx_wedding_members_user_id    ON wedding_members(user_id);

-- SECURITY DEFINER + search_path fixo: esta function é usada DENTRO das policies de
-- várias outras tabelas (inclusive a própria wedding_members). Se ela dependesse da
-- RLS de wedding_members pra fazer sua própria leitura, viraria referência circular
-- de policy — SECURITY DEFINER contorna isso lendo a tabela com privilégio do dono
-- da function, não do usuário que disparou a query.
CREATE OR REPLACE FUNCTION fn_is_wedding_member(p_wedding_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wedding_members
    WHERE wedding_id = p_wedding_id AND user_id = p_user_id
  );
$$;

ALTER TABLE wedding_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read fellow members of their wedding"
  ON wedding_members FOR SELECT
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- Sem policy de INSERT/DELETE direta pro client: entrar como membro só acontece
-- aceitando um convite (rota de API, service role, confere o token) e sair/remover
-- só o dono pode fazer (rota de API, confere ownership em código). Isso evita que
-- qualquer pessoa insira a si mesma como membro de um casamento sem convite.

-- =========================================================
-- wedding_invites
-- =========================================================
CREATE TABLE wedding_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wedding_invites_wedding_id ON wedding_invites(wedding_id);
CREATE INDEX idx_wedding_invites_token      ON wedding_invites(token);

ALTER TABLE wedding_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wedding owner can read own invites"
  ON wedding_invites FOR SELECT
  USING (EXISTS (SELECT 1 FROM weddings w WHERE w.id = wedding_invites.wedding_id AND w.user_id = auth.uid()));

CREATE POLICY "wedding owner can create invites"
  ON wedding_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM weddings w WHERE w.id = wedding_invites.wedding_id AND w.user_id = auth.uid())
  );

CREATE POLICY "wedding owner can revoke own invites"
  ON wedding_invites FOR UPDATE
  USING (EXISTS (SELECT 1 FROM weddings w WHERE w.id = wedding_invites.wedding_id AND w.user_id = auth.uid()));

-- Sem policy de leitura/aceite por token pra anônimo: quem está aceitando um convite
-- ainda não é membro (é por isso que está aceitando), então a leitura do convite pelo
-- token e o aceite acontecem via client service role na API — mesmo padrão já usado
-- pro RSVP público (ver src/lib/rsvp/get-rsvp-by-token.ts).

-- =========================================================
-- Trigger: dono vira membro automaticamente ao criar o casamento
-- =========================================================
CREATE OR REPLACE FUNCTION fn_add_owner_as_wedding_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wedding_members (wedding_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (wedding_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_weddings_add_owner_member
  AFTER INSERT ON weddings
  FOR EACH ROW EXECUTE FUNCTION fn_add_owner_as_wedding_member();

-- Backfill: casamentos criados antes desta migration não têm nenhuma linha em
-- wedding_members ainda — sem isso, o dono perderia acesso aos próprios dados no
-- exato momento em que a RLS das tabelas filhas passar a exigir fn_is_wedding_member.
INSERT INTO wedding_members (wedding_id, user_id, role)
SELECT id, user_id, 'owner' FROM weddings
ON CONFLICT (wedding_id, user_id) DO NOTHING;

-- =========================================================
-- plan_limits: cota de usuários por casamento (feature "max_users")
-- Valores batem com a tabela de comparação de planos (plan-selector.tsx)
-- =========================================================
INSERT INTO plan_limits (plan_id, feature, value) VALUES
  ('free',                 'max_users', 1),
  ('premium_monthly',      'max_users', 5),
  ('premium_once',         'max_users', 5),
  ('premium_plus_monthly', 'max_users', 10),
  ('premium_plus_once',    'max_users', 10);

-- =========================================================
-- weddings: membros também podem ler/editar (antes só o dono)
-- INSERT permanece intocado — cada conta só cria o próprio casamento
-- (auth.uid() = user_id), "1 casamento por conta" continua valendo pro dono.
-- =========================================================
DROP POLICY "users can read own weddings" ON weddings;
CREATE POLICY "members can read their wedding"
  ON weddings FOR SELECT
  USING (fn_is_wedding_member(id, auth.uid()) AND deleted_at IS NULL);

DROP POLICY "users can update own weddings" ON weddings;
DROP POLICY "users can soft-delete own weddings" ON weddings;
CREATE POLICY "members can update their wedding"
  ON weddings FOR UPDATE
  USING (fn_is_wedding_member(id, auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (fn_is_wedding_member(id, auth.uid()));

-- =========================================================
-- Tabelas filhas: trocar o EXISTS direto em weddings.user_id por
-- fn_is_wedding_member (dono OU membro convidado têm o mesmo acesso)
-- =========================================================

-- checklist_items
DROP POLICY "users can read own checklist items"   ON checklist_items;
DROP POLICY "users can insert own checklist items" ON checklist_items;
DROP POLICY "users can update own checklist items" ON checklist_items;
DROP POLICY "users can delete own checklist items" ON checklist_items;
CREATE POLICY "members can read wedding checklist items"   ON checklist_items FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding checklist items" ON checklist_items FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding checklist items" ON checklist_items FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding checklist items" ON checklist_items FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- guests
DROP POLICY "users can read own guests"   ON guests;
DROP POLICY "users can insert own guests" ON guests;
DROP POLICY "users can update own guests" ON guests;
DROP POLICY "users can delete own guests" ON guests;
CREATE POLICY "members can read wedding guests"   ON guests FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding guests" ON guests FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding guests" ON guests FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding guests" ON guests FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- financial_entries
DROP POLICY "users can read own financial entries"   ON financial_entries;
DROP POLICY "users can insert own financial entries" ON financial_entries;
DROP POLICY "users can update own financial entries" ON financial_entries;
DROP POLICY "users can delete own financial entries" ON financial_entries;
CREATE POLICY "members can read wedding financial entries"   ON financial_entries FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding financial entries" ON financial_entries FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding financial entries" ON financial_entries FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding financial entries" ON financial_entries FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- tables_config
DROP POLICY "users can read own tables config"   ON tables_config;
DROP POLICY "users can insert own tables config" ON tables_config;
DROP POLICY "users can update own tables config" ON tables_config;
DROP POLICY "users can delete own tables config" ON tables_config;
CREATE POLICY "members can read wedding tables config"   ON tables_config FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding tables config" ON tables_config FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding tables config" ON tables_config FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding tables config" ON tables_config FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- table_assignments (sem wedding_id direto -> RLS passa por tables_config)
DROP POLICY "users can read own table assignments"   ON table_assignments;
DROP POLICY "users can insert own table assignments" ON table_assignments;
DROP POLICY "users can update own table assignments" ON table_assignments;
DROP POLICY "users can delete own table assignments" ON table_assignments;
CREATE POLICY "members can read wedding table assignments"   ON table_assignments FOR SELECT USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_is_wedding_member(tc.wedding_id, auth.uid())));
CREATE POLICY "members can insert wedding table assignments" ON table_assignments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_is_wedding_member(tc.wedding_id, auth.uid())));
CREATE POLICY "members can update wedding table assignments" ON table_assignments FOR UPDATE USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_is_wedding_member(tc.wedding_id, auth.uid())));
CREATE POLICY "members can delete wedding table assignments" ON table_assignments FOR DELETE USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_is_wedding_member(tc.wedding_id, auth.uid())));

-- site_config ("anyone can read published site config" é independente de posse, fica como está)
DROP POLICY "users can read own site config"   ON site_config;
DROP POLICY "users can insert own site config" ON site_config;
DROP POLICY "users can update own site config" ON site_config;
DROP POLICY "users can delete own site config" ON site_config;
CREATE POLICY "members can read wedding site config"   ON site_config FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding site config" ON site_config FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding site config" ON site_config FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding site config" ON site_config FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- gift_registry_items
DROP POLICY "users can read own gift registry items"   ON gift_registry_items;
DROP POLICY "users can insert own gift registry items" ON gift_registry_items;
DROP POLICY "users can update own gift registry items" ON gift_registry_items;
DROP POLICY "users can delete own gift registry items" ON gift_registry_items;
CREATE POLICY "members can read wedding gift registry items"   ON gift_registry_items FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding gift registry items" ON gift_registry_items FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding gift registry items" ON gift_registry_items FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding gift registry items" ON gift_registry_items FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- wedding_preferences (nunca teve policy de DELETE)
DROP POLICY "users can read own wedding preferences"   ON wedding_preferences;
DROP POLICY "users can insert own wedding preferences" ON wedding_preferences;
DROP POLICY "users can update own wedding preferences" ON wedding_preferences;
CREATE POLICY "members can read wedding preferences"   ON wedding_preferences FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding preferences" ON wedding_preferences FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding preferences" ON wedding_preferences FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));

-- wedding_files (tabela de metadados + storage.objects do bucket privado)
DROP POLICY "users can read own wedding files"   ON wedding_files;
DROP POLICY "users can insert own wedding files" ON wedding_files;
DROP POLICY "users can update own wedding files" ON wedding_files;
DROP POLICY "users can delete own wedding files" ON wedding_files;
CREATE POLICY "members can read wedding files"   ON wedding_files FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding files" ON wedding_files FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding files" ON wedding_files FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding files" ON wedding_files FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

DROP POLICY "users can read own wedding files in storage"    ON storage.objects;
DROP POLICY "users can upload own wedding files to storage"  ON storage.objects;
DROP POLICY "users can delete own wedding files from storage" ON storage.objects;
CREATE POLICY "members can read wedding files in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wedding-files' AND fn_is_wedding_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "members can upload wedding files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wedding-files' AND fn_is_wedding_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "members can delete wedding files from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wedding-files' AND fn_is_wedding_member((storage.foldername(name))[1]::uuid, auth.uid()));

-- wedding_gallery_photos (tabela de metadados + storage.objects do bucket público)
-- "anyone can view wedding gallery photos in storage" fica como está — SELECT do bucket
-- é público de propósito (fotos aparecem em /[slug] sem autenticação).
DROP POLICY "users can read own wedding gallery photos"   ON wedding_gallery_photos;
DROP POLICY "users can insert own wedding gallery photos" ON wedding_gallery_photos;
DROP POLICY "users can update own wedding gallery photos" ON wedding_gallery_photos;
DROP POLICY "users can delete own wedding gallery photos" ON wedding_gallery_photos;
CREATE POLICY "members can read wedding gallery photos"   ON wedding_gallery_photos FOR SELECT USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can insert wedding gallery photos" ON wedding_gallery_photos FOR INSERT WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can update wedding gallery photos" ON wedding_gallery_photos FOR UPDATE USING (fn_is_wedding_member(wedding_id, auth.uid()));
CREATE POLICY "members can delete wedding gallery photos" ON wedding_gallery_photos FOR DELETE USING (fn_is_wedding_member(wedding_id, auth.uid()));

DROP POLICY "users can upload own wedding gallery photos to storage"  ON storage.objects;
DROP POLICY "users can delete own wedding gallery photos from storage" ON storage.objects;
CREATE POLICY "members can upload wedding gallery photos to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wedding-photos' AND fn_is_wedding_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "members can delete wedding gallery photos from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wedding-photos' AND fn_is_wedding_member((storage.foldername(name))[1]::uuid, auth.uid()));

-- =========================================================
-- subscriptions: membro convidado precisa enxergar o plano do DONO do
-- casamento, senão todo gating (checkGuestLimit, PaywallGate etc.) trata o
-- membro como se estivesse sempre no Gratuito — quem paga é sempre o dono
-- (subscriptions.user_id do dono), nunca o membro.
--
-- Isso ADICIONA uma policy de SELECT (não substitui "users can read own
-- subscriptions") — policies do mesmo comando são combinadas com OR pelo
-- Postgres, então cada usuário continua vendo a própria assinatura de sempre,
-- e passa a enxergar também a do dono de qualquer casamento em que é membro.
-- subscriptions não guarda dado de pagamento (cartão etc., isso é Fase 2) —
-- só plan_id/status/datas/gateway_sub_id, então expor leitura pros membros do
-- mesmo casamento é aceitável.
-- =========================================================
CREATE POLICY "members can read their wedding owner's subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.user_id = subscriptions.user_id
      AND fn_is_wedding_member(w.id, auth.uid())
    )
  );
