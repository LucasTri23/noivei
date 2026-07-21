-- Controle de parcelas do Financeiro — disponível em TODOS os planos (diferente de
-- Orçamentos, que é Premium+). Um lançamento (financial_entries) pode ter um plano
-- de pagamento parcelado (ex.: entrada + 6 parcelas mensais do local), cada parcela
-- com seu próprio vencimento e status de pago.
--
-- financial_entries.paid_amount continua sendo a soma das parcelas pagas — mantido
-- em sincronia pela API (não por trigger), mesmo estilo do resto do projeto (regras
-- de negócio em código, não em trigger de banco, exceto updated_at/casos já
-- estabelecidos). Isso preserva o hero card e o painel "Por categoria" do Financeiro
-- funcionando sem nenhuma mudança, já que eles só leem total_amount/paid_amount.

CREATE TABLE financial_installments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id          UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  financial_entry_id  UUID NOT NULL REFERENCES financial_entries(id) ON DELETE CASCADE,
  installment_number  INTEGER NOT NULL, -- 1-based; a primeira costuma ser a "entrada"
  total_installments  INTEGER NOT NULL,
  amount_cents        INTEGER NOT NULL,
  due_date            DATE NOT NULL,
  paid                BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (financial_entry_id, installment_number)
);

CREATE INDEX idx_financial_installments_wedding_id  ON financial_installments(wedding_id);
CREATE INDEX idx_financial_installments_entry_id    ON financial_installments(financial_entry_id);
CREATE INDEX idx_financial_installments_due_date    ON financial_installments(due_date) WHERE paid = FALSE;

ALTER TABLE financial_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read financial installments"
  ON financial_installments FOR SELECT
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can insert financial installments"
  ON financial_installments FOR INSERT
  WITH CHECK (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can update financial installments"
  ON financial_installments FOR UPDATE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));

CREATE POLICY "members can delete financial installments"
  ON financial_installments FOR DELETE
  USING (fn_is_wedding_member(wedding_id, auth.uid()));
