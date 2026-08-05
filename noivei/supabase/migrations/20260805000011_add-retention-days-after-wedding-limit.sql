-- Prazo (em dias, contados a partir de weddings.wedding_date) até o casamento ser
-- excluído automaticamente, independente do casal pedir ou não — decisão de
-- produto: plano Gratuito guarda por 30 dias após o casamento, planos pagos
-- (Ideal e Exclusivo, mensal ou único) por 365 dias. Mesmo padrão de
-- `plan_limits` já usado pra outros números que variam por plano (max_guests
-- etc.) — editável sem deploy em /admin/planos.
--
-- Isso é DIFERENTE do prazo de expurgo definitivo já existente
-- (app_settings.account_purge_days, migration 20260805000002): aquele conta a
-- partir do momento em que a conta é marcada pra exclusão (ação do casal);
-- este novo limite é o gatilho que MARCA a conta pra exclusão automaticamente,
-- mesmo que o casal nunca peça — baseado na data do casamento, não numa ação
-- do usuário. Depois de marcada (weddings.deleted_at preenchido por este
-- gatilho), o expurgo definitivo segue o fluxo de sempre.
INSERT INTO plan_limits (plan_id, feature, value) VALUES
  ('free',                 'retention_days_after_wedding', 30),
  ('premium_monthly',      'retention_days_after_wedding', 365),
  ('premium_once',         'retention_days_after_wedding', 365),
  ('premium_plus_monthly', 'retention_days_after_wedding', 365),
  ('premium_plus_once',    'retention_days_after_wedding', 365)
ON CONFLICT (plan_id, feature) DO UPDATE SET value = EXCLUDED.value;
