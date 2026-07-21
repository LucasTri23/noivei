-- Tabela: gift_registry_items
-- RLS: wedding_id -> weddings.user_id = auth.uid(), mesmo padrão de guests/financial_entries
-- Escopo desta migration: apenas gerenciamento interno do casal (CRUD + marcar como já dado).
-- Fluxo público de convidado reservar/comprar presente fica para quando o "Site do casal" existir de fato.

-- =========================================================
-- gift_registry_items
-- =========================================================
CREATE TABLE gift_registry_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  price_cents  INTEGER,                 -- em centavos; nem todo item tem preço definido
  store_url    TEXT,                    -- link pra onde comprar (ex: Amazon/loja de casamento)
  image_url    TEXT,
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_by TEXT,                    -- nome de quem deu, preenchido manualmente pelo casal
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gift_registry_items_wedding_id ON gift_registry_items(wedding_id);

ALTER TABLE gift_registry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own gift registry items"
  ON gift_registry_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = gift_registry_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own gift registry items"
  ON gift_registry_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = gift_registry_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own gift registry items"
  ON gift_registry_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = gift_registry_items.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own gift registry items"
  ON gift_registry_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = gift_registry_items.wedding_id AND w.user_id = auth.uid()
  ));
