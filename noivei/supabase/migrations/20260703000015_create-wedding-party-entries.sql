-- Aba "Padrinhos & Entradas" — cortejo do casamento (§4.4/§4.7 do motor de regras,
-- docs/checklist-rule-engine.md). Fonte das pessoas é sempre a lista de convidados já
-- cadastrados (guest_id NOT NULL) — não se cadastra gente nova aqui, só se atribui um
-- papel no cortejo a quem já é convidado.
--
-- Gratuito: além da entrada dos noivos (que não é uma linha aqui — é sempre implícita
-- na UI, o casal em si), só 2 entradas adicionais. Pago: ilimitado (feature
-- "max_wedding_party_entries" em plan_limits, valor 2 no Gratuito).

CREATE TABLE wedding_party_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id          UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_id            UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  role                TEXT NOT NULL, -- ex: "Padrinho", "Madrinha", "Daminha", "Pajem", livre
  carries_rings       BOOLEAN NOT NULL DEFAULT FALSE,
  paired_with_entry_id UUID REFERENCES wedding_party_entries(id) ON DELETE SET NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0, -- ordem de entrada no cortejo
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedding_id, guest_id) -- um convidado só tem uma entrada no cortejo
);

CREATE INDEX idx_wedding_party_entries_wedding_id ON wedding_party_entries(wedding_id);

ALTER TABLE wedding_party_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read wedding party entries"
  ON wedding_party_entries FOR SELECT
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can insert wedding party entries"
  ON wedding_party_entries FOR INSERT
  WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can update wedding party entries"
  ON wedding_party_entries FOR UPDATE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can delete wedding party entries"
  ON wedding_party_entries FOR DELETE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

INSERT INTO plan_limits (plan_id, feature, value) VALUES
  ('free',                 'max_wedding_party_entries', 2),
  ('premium_monthly',      'max_wedding_party_entries', 999999),
  ('premium_once',         'max_wedding_party_entries', 999999),
  ('premium_plus_monthly', 'max_wedding_party_entries', 999999),
  ('premium_plus_once',    'max_wedding_party_entries', 999999);
