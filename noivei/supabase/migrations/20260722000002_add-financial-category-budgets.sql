-- Meta de gastos por categoria no Financeiro (Premium/Premium Plus) — o casal define
-- quanto pretende gastar em cada categoria de lançamento (ex.: "Decoração & Flores:
-- R$ 5.000") e o app sinaliza visualmente quando o comprometido
-- (financial_entries.total_amount somado por categoria) ultrapassa essa meta.
-- Categoria é texto livre, casada por igualdade exata com financial_entries.category
-- (mesma convenção já usada no agrupamento "Por categoria" do Financeiro).
--
-- Mesmo gate de plano de "Orçamentos"/"Por categoria" (isPaidPlan) — RLS usa
-- fn_has_module_access(..., 'financeiro'), mesmo padrão de financial_entries/
-- financial_quotes/financial_installments.

CREATE TABLE financial_category_budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  budget_cents INTEGER NOT NULL CHECK (budget_cents >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedding_id, category)
);

CREATE INDEX idx_financial_category_budgets_wedding_id ON financial_category_budgets(wedding_id);

CREATE TRIGGER trg_financial_category_budgets_updated_at
  BEFORE UPDATE ON financial_category_budgets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE financial_category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read financial category budgets"
  ON financial_category_budgets FOR SELECT
  USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

CREATE POLICY "members can insert financial category budgets"
  ON financial_category_budgets FOR INSERT
  WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

CREATE POLICY "members can update financial category budgets"
  ON financial_category_budgets FOR UPDATE
  USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));

CREATE POLICY "members can delete financial category budgets"
  ON financial_category_budgets FOR DELETE
  USING (fn_has_module_access(wedding_id, auth.uid(), 'financeiro'));
