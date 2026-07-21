-- Permissões por módulo ("função" do membro) — "Membros do casamento".
--
-- Até aqui, todo membro convidado tinha o MESMO acesso do dono a todos os módulos
-- (checklist, convidados, financeiro, mesas, site, arquivos, presentes, padrinhos).
-- O dono do produto quer poder restringir isso na hora do convite: se o papel for
-- "Noivo/Noiva" (ou o próprio dono), acesso completo; qualquer outro papel
-- (cerimonialista, familiar, assessor...), só os módulos que o casal escolher.
--
-- `permissions` é um JSONB com o shape:
--   { "full_access": true }
--   { "full_access": false, "modules": { "checklist": true, "financeiro": false, ... } }
-- Guardado tanto em wedding_invites (definido pelo dono ao criar o convite) quanto em
-- wedding_members (copiado do convite no momento do aceite — depois disso é
-- independente do convite, que pode até ser apagado/expirar sem afetar o membro já
-- aceito).
--
-- fn_has_module_access() substitui fn_is_wedding_member() nas policies de tabelas
-- que pertencem a um módulo específico — dono sempre passa (role = 'owner'); membro
-- passa se full_access=true OU se o módulo específico está liberado. Tabelas que não
-- pertencem a nenhum módulo restrito (weddings, wedding_members, wedding_invites,
-- wedding_preferences* ) continuam em fn_is_wedding_member, sem mudança.
--
-- *wedding_preferences fica de fora de propósito: são as respostas do onboarding que
-- geram o checklist, não uma tela separada que o dono precise restringir.
--
-- COALESCE fail-closed no full_access (default `false`): a coluna é NOT NULL com
-- default `{"full_access": true}`, então isso nunca deveria faltar na prática — mas o
-- fallback de uma checagem de permissão deve sempre negar, nunca conceder, se o dado
-- vier incompleto por qualquer motivo.

ALTER TABLE wedding_members ADD COLUMN permissions JSONB NOT NULL DEFAULT '{"full_access": true}'::jsonb;
ALTER TABLE wedding_invites ADD COLUMN permissions JSONB NOT NULL DEFAULT '{"full_access": true}'::jsonb;

CREATE OR REPLACE FUNCTION fn_has_module_access(p_wedding_id UUID, p_user_id UUID, p_module TEXT)
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
      AND (
        role = 'owner'
        OR COALESCE((permissions->>'full_access')::boolean, false)
        OR COALESCE((permissions->'modules'->>p_module)::boolean, false)
      )
  );
$$;

-- =========================================================
-- checklist_items — módulo "checklist"
-- =========================================================
DROP POLICY "members can read wedding checklist items"   ON checklist_items;
DROP POLICY "members can insert wedding checklist items" ON checklist_items;
DROP POLICY "members can update wedding checklist items" ON checklist_items;
DROP POLICY "members can delete wedding checklist items" ON checklist_items;
CREATE POLICY "members can read wedding checklist items"   ON checklist_items FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'checklist'));
CREATE POLICY "members can insert wedding checklist items" ON checklist_items FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'checklist'));
CREATE POLICY "members can update wedding checklist items" ON checklist_items FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'checklist'));
CREATE POLICY "members can delete wedding checklist items" ON checklist_items FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'checklist'));

-- guests — módulo "convidados"
DROP POLICY "members can read wedding guests"   ON guests;
DROP POLICY "members can insert wedding guests" ON guests;
DROP POLICY "members can update wedding guests" ON guests;
DROP POLICY "members can delete wedding guests" ON guests;
CREATE POLICY "members can read wedding guests"   ON guests FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'convidados'));
CREATE POLICY "members can insert wedding guests" ON guests FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'convidados'));
CREATE POLICY "members can update wedding guests" ON guests FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'convidados'));
CREATE POLICY "members can delete wedding guests" ON guests FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'convidados'));

-- financial_entries / financial_quotes / financial_installments — módulo "financeiro"
DROP POLICY "members can read wedding financial entries"   ON financial_entries;
DROP POLICY "members can insert wedding financial entries" ON financial_entries;
DROP POLICY "members can update wedding financial entries" ON financial_entries;
DROP POLICY "members can delete wedding financial entries" ON financial_entries;
CREATE POLICY "members can read wedding financial entries"   ON financial_entries FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can insert wedding financial entries" ON financial_entries FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can update wedding financial entries" ON financial_entries FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can delete wedding financial entries" ON financial_entries FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

DROP POLICY "members can read financial quotes"   ON financial_quotes;
DROP POLICY "members can insert financial quotes" ON financial_quotes;
DROP POLICY "members can update financial quotes" ON financial_quotes;
DROP POLICY "members can delete financial quotes" ON financial_quotes;
CREATE POLICY "members can read financial quotes"   ON financial_quotes FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can insert financial quotes" ON financial_quotes FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can update financial quotes" ON financial_quotes FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can delete financial quotes" ON financial_quotes FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

DROP POLICY "members can read financial installments"   ON financial_installments;
DROP POLICY "members can insert financial installments" ON financial_installments;
DROP POLICY "members can update financial installments" ON financial_installments;
DROP POLICY "members can delete financial installments" ON financial_installments;
CREATE POLICY "members can read financial installments"   ON financial_installments FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can insert financial installments" ON financial_installments FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can update financial installments" ON financial_installments FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
CREATE POLICY "members can delete financial installments" ON financial_installments FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

-- tables_config / table_assignments — módulo "mesas"
DROP POLICY "members can read wedding tables config"   ON tables_config;
DROP POLICY "members can insert wedding tables config" ON tables_config;
DROP POLICY "members can update wedding tables config" ON tables_config;
DROP POLICY "members can delete wedding tables config" ON tables_config;
CREATE POLICY "members can read wedding tables config"   ON tables_config FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'mesas'));
CREATE POLICY "members can insert wedding tables config" ON tables_config FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'mesas'));
CREATE POLICY "members can update wedding tables config" ON tables_config FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'mesas'));
CREATE POLICY "members can delete wedding tables config" ON tables_config FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'mesas'));

DROP POLICY "members can read wedding table assignments"   ON table_assignments;
DROP POLICY "members can insert wedding table assignments" ON table_assignments;
DROP POLICY "members can update wedding table assignments" ON table_assignments;
DROP POLICY "members can delete wedding table assignments" ON table_assignments;
CREATE POLICY "members can read wedding table assignments"   ON table_assignments FOR SELECT USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_has_module_access(tc.wedding_id, auth.uid(), 'mesas')));
CREATE POLICY "members can insert wedding table assignments" ON table_assignments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_has_module_access(tc.wedding_id, auth.uid(), 'mesas')));
CREATE POLICY "members can update wedding table assignments" ON table_assignments FOR UPDATE USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_has_module_access(tc.wedding_id, auth.uid(), 'mesas')));
CREATE POLICY "members can delete wedding table assignments" ON table_assignments FOR DELETE USING (EXISTS (SELECT 1 FROM tables_config tc WHERE tc.id = table_assignments.table_id AND fn_has_module_access(tc.wedding_id, auth.uid(), 'mesas')));

-- site_config e a Galeria do site (wedding_gallery_photos) — módulo "site"
-- ("anyone can read published site config" continua igual, é público de propósito)
DROP POLICY "members can read wedding site config"   ON site_config;
DROP POLICY "members can insert wedding site config" ON site_config;
DROP POLICY "members can update wedding site config" ON site_config;
DROP POLICY "members can delete wedding site config" ON site_config;
CREATE POLICY "members can read wedding site config"   ON site_config FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can insert wedding site config" ON site_config FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can update wedding site config" ON site_config FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can delete wedding site config" ON site_config FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));

DROP POLICY "members can read wedding gallery photos"   ON wedding_gallery_photos;
DROP POLICY "members can insert wedding gallery photos" ON wedding_gallery_photos;
DROP POLICY "members can update wedding gallery photos" ON wedding_gallery_photos;
DROP POLICY "members can delete wedding gallery photos" ON wedding_gallery_photos;
CREATE POLICY "members can read wedding gallery photos"   ON wedding_gallery_photos FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can insert wedding gallery photos" ON wedding_gallery_photos FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can update wedding gallery photos" ON wedding_gallery_photos FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can delete wedding gallery photos" ON wedding_gallery_photos FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));

DROP POLICY "members can upload wedding gallery photos to storage"  ON storage.objects;
DROP POLICY "members can delete wedding gallery photos from storage" ON storage.objects;
CREATE POLICY "members can upload wedding gallery photos to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wedding-photos' AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'site'));
CREATE POLICY "members can delete wedding gallery photos from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wedding-photos' AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'site'));
-- "anyone can view wedding gallery photos in storage" (SELECT) não muda — bucket público de propósito.

-- wedding_files + storage — módulo "arquivos" (Central de Arquivos, distinta da Galeria do site)
DROP POLICY "members can read wedding files"   ON wedding_files;
DROP POLICY "members can insert wedding files" ON wedding_files;
DROP POLICY "members can update wedding files" ON wedding_files;
DROP POLICY "members can delete wedding files" ON wedding_files;
CREATE POLICY "members can read wedding files"   ON wedding_files FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'arquivos'));
CREATE POLICY "members can insert wedding files" ON wedding_files FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'arquivos'));
CREATE POLICY "members can update wedding files" ON wedding_files FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'arquivos'));
CREATE POLICY "members can delete wedding files" ON wedding_files FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'arquivos'));

DROP POLICY "members can read wedding files in storage"    ON storage.objects;
DROP POLICY "members can upload wedding files to storage"  ON storage.objects;
DROP POLICY "members can delete wedding files from storage" ON storage.objects;
CREATE POLICY "members can read wedding files in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wedding-files' AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'arquivos'));
CREATE POLICY "members can upload wedding files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wedding-files' AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'arquivos'));
CREATE POLICY "members can delete wedding files from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wedding-files' AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'arquivos'));

-- gift_registry_items — módulo "presentes"
DROP POLICY "members can read wedding gift registry items"   ON gift_registry_items;
DROP POLICY "members can insert wedding gift registry items" ON gift_registry_items;
DROP POLICY "members can update wedding gift registry items" ON gift_registry_items;
DROP POLICY "members can delete wedding gift registry items" ON gift_registry_items;
CREATE POLICY "members can read wedding gift registry items"   ON gift_registry_items FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'presentes'));
CREATE POLICY "members can insert wedding gift registry items" ON gift_registry_items FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'presentes'));
CREATE POLICY "members can update wedding gift registry items" ON gift_registry_items FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'presentes'));
CREATE POLICY "members can delete wedding gift registry items" ON gift_registry_items FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'presentes'));

-- wedding_party_entries — módulo "padrinhos"
DROP POLICY "members can read wedding party entries"   ON wedding_party_entries;
DROP POLICY "members can insert wedding party entries" ON wedding_party_entries;
DROP POLICY "members can update wedding party entries" ON wedding_party_entries;
DROP POLICY "members can delete wedding party entries" ON wedding_party_entries;
CREATE POLICY "members can read wedding party entries"   ON wedding_party_entries FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'padrinhos'));
CREATE POLICY "members can insert wedding party entries" ON wedding_party_entries FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'padrinhos'));
CREATE POLICY "members can update wedding party entries" ON wedding_party_entries FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'padrinhos'));
CREATE POLICY "members can delete wedding party entries" ON wedding_party_entries FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'padrinhos'));
