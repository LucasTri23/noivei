-- Tabelas: checklist_items, guests, financial_entries, tables_config, table_assignments, site_config
-- RLS: wedding_id -> weddings.user_id = auth.uid() em todas
-- checklist_items já nasce com as colunas do motor de regras (categoria/fase/catálogo) — ver docs/checklist-rule-engine.md

-- =========================================================
-- checklist_items
-- =========================================================
CREATE TABLE checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  category     TEXT,                     -- categoria do checklist (ex: "Planejamento & Organização")
  phase        TEXT,                     -- fase da timeline (ex: "fundacao", "reta-final")
  catalog_key  TEXT,                     -- chave estável do catálogo de tarefas (para regenerar sem duplicar)
  due_date     DATE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE, -- casal marcou "não se aplica"
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE, -- regra ficou falsa após conclusão — mantém histórico, some da lista ativa
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_wedding_id ON checklist_items(wedding_id);
CREATE UNIQUE INDEX idx_checklist_items_wedding_catalog_key ON checklist_items(wedding_id, catalog_key) WHERE catalog_key IS NOT NULL;

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own checklist items"
  ON checklist_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = checklist_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own checklist items"
  ON checklist_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = checklist_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own checklist items"
  ON checklist_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = checklist_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own checklist items"
  ON checklist_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = checklist_items.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- guests
-- =========================================================
CREATE TABLE guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  group_name  TEXT,
  status      TEXT NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('confirmado', 'pendente', 'recusado')),
  rsvp_token  TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guests_wedding_id ON guests(wedding_id);
CREATE INDEX idx_guests_rsvp_token ON guests(rsvp_token);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own guests"
  ON guests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = guests.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own guests"
  ON guests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = guests.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own guests"
  ON guests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = guests.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own guests"
  ON guests FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = guests.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- financial_entries
-- =========================================================
CREATE TABLE financial_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category     TEXT,
  vendor       TEXT,
  description  TEXT NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0, -- em centavos
  paid_amount  INTEGER NOT NULL DEFAULT 0, -- em centavos
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_entries_wedding_id ON financial_entries(wedding_id);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own financial entries"
  ON financial_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = financial_entries.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own financial entries"
  ON financial_entries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = financial_entries.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own financial entries"
  ON financial_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = financial_entries.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own financial entries"
  ON financial_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = financial_entries.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- tables_config
-- =========================================================
CREATE TABLE tables_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  capacity    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tables_config_wedding_id ON tables_config(wedding_id);

ALTER TABLE tables_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own tables config"
  ON tables_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = tables_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own tables config"
  ON tables_config FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = tables_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own tables config"
  ON tables_config FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = tables_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own tables config"
  ON tables_config FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = tables_config.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- table_assignments
-- (sem wedding_id direto -> RLS passa por tables_config)
-- =========================================================
CREATE TABLE table_assignments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id  UUID NOT NULL REFERENCES tables_config(id) ON DELETE CASCADE,
  guest_id  UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guest_id)
);

CREATE INDEX idx_table_assignments_table_id ON table_assignments(table_id);
CREATE INDEX idx_table_assignments_guest_id ON table_assignments(guest_id);

ALTER TABLE table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own table assignments"
  ON table_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tables_config tc
    JOIN weddings w ON w.id = tc.wedding_id
    WHERE tc.id = table_assignments.table_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own table assignments"
  ON table_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tables_config tc
    JOIN weddings w ON w.id = tc.wedding_id
    WHERE tc.id = table_assignments.table_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own table assignments"
  ON table_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tables_config tc
    JOIN weddings w ON w.id = tc.wedding_id
    WHERE tc.id = table_assignments.table_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own table assignments"
  ON table_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tables_config tc
    JOIN weddings w ON w.id = tc.wedding_id
    WHERE tc.id = table_assignments.table_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- site_config
-- =========================================================
CREATE TABLE site_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id       UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE,
  published        BOOLEAN NOT NULL DEFAULT FALSE,
  cover_photo_url  TEXT,
  content          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_config_wedding_id ON site_config(wedding_id);
CREATE INDEX idx_site_config_slug ON site_config(slug);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own site config"
  ON site_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = site_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own site config"
  ON site_config FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = site_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own site config"
  ON site_config FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = site_config.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own site config"
  ON site_config FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = site_config.wedding_id AND w.user_id = auth.uid()
  ));
