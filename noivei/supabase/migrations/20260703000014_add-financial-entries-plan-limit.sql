-- =========================================================
-- plan_limits: cota de lançamentos financeiros (feature "max_financial_entries")
-- Alinha o módulo Financeiro com a tabela de comparação de planos (plan-selector.tsx):
-- Gratuito = Básico (limitado), Premium/Premium Plus = Completo (ilimitado)
-- =========================================================
INSERT INTO plan_limits (plan_id, feature, value) VALUES
  ('free',                 'max_financial_entries', 15),
  ('premium_monthly',      'max_financial_entries', 999999),
  ('premium_once',         'max_financial_entries', 999999),
  ('premium_plus_monthly', 'max_financial_entries', 999999),
  ('premium_plus_once',    'max_financial_entries', 999999);
