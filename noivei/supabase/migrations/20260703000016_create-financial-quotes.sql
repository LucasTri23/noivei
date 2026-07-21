-- Aba "Orçamentos" do Financeiro — feature Premium+ (não Gratuito). O casal
-- cadastra várias cotações por categoria (ex.: 3 espaços cotados) e escolhe UMA
-- de cada categoria; a seleção vira um lançamento real em financial_entries
-- (financial_entry_id aponta pra ele) e pode marcar tarefas do Checklist como
-- concluídas (feito em código na rota de "select", não aqui).
--
-- Gate de plano é reforçado na rota de API (não há linha nova em plan_limits
-- aqui) — não é um limite contável, é um bloqueio binário por plano.

CREATE TABLE financial_quotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id          UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('local','buffet','fotografia','decoracao','musica','outro')),
  vendor_name         TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL,
  notes               TEXT,
  is_selected         BOOLEAN NOT NULL DEFAULT FALSE,
  financial_entry_id  UUID REFERENCES financial_entries(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_quotes_wedding_id ON financial_quotes(wedding_id);

ALTER TABLE financial_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read financial quotes"
  ON financial_quotes FOR SELECT
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can insert financial quotes"
  ON financial_quotes FOR INSERT
  WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can update financial quotes"
  ON financial_quotes FOR UPDATE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can delete financial quotes"
  ON financial_quotes FOR DELETE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));
