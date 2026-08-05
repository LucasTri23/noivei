-- Prazo (em dias) entre o soft-delete de uma conta (weddings.deleted_at) e o
-- expurgo definitivo do Storage + banco (ver cron/purge-accounts, migration
-- 20260703000009_create-purge-soft-deleted-accounts.sql e o comentário no
-- topo de src/app/api/cron/purge-accounts/route.ts sobre LGPD art. 18 VI).
-- Era um valor fixo (30 dias) direto no código da rota de cron; agora fica
-- configurável em /admin/configuracoes, mesmo padrão de platform_fee_percent
-- (ver migration 20260727000002_gift-payments-marketplace-split.sql).
-- Mínimo 7 dias para a exclusão nunca ser instantânea demais (dar tempo real
-- de arrependimento/reativação pelo suporte, ver comentário na migration
-- 20260703000009), máximo 365 como teto de bom senso.
ALTER TABLE app_settings
  ADD COLUMN account_purge_days INTEGER NOT NULL DEFAULT 30
    CHECK (account_purge_days BETWEEN 7 AND 365);
