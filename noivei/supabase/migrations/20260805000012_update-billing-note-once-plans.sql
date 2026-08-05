-- Alinha o texto de `billing_note` dos planos de pagamento único com o prazo
-- real de retenção agora aplicado de verdade pelo cron
-- /api/cron/auto-delete-after-wedding (migration 20260805000011): 365 dias após
-- o casamento pros dois planos pagos — antes o texto do Exclusivo era vago
-- ("por um período") porque nenhum prazo era realmente aplicado em código.
UPDATE plans SET billing_note = 'válido até 1 ano após o casamento'
  WHERE id = 'premium_plus_once';
