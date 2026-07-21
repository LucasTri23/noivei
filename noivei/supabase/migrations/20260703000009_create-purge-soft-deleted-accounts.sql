-- Purge definitivo (LGPD) de contas soft-deletadas há mais de 30 dias.
--
-- weddings.user_id referencia auth.users(id) ON DELETE CASCADE, e todas as
-- tabelas filhas (checklist_items, guests, financial_entries, gift_registry,
-- wedding_preferences etc.) referenciam weddings(id) ON DELETE CASCADE.
-- Ou seja, apagar o registro em auth.users é suficiente para apagar em cadeia
-- todos os dados do casal — não é necessário deletar weddings separadamente.
--
-- Reativação dentro dos 30 dias (mencionada no modal de exclusão em
-- delete-account-button.tsx) não tem rota própria ainda: é um
-- `UPDATE weddings SET deleted_at = NULL, is_active = true WHERE user_id = ...`
-- feito manualmente pelo suporte via SQL/dashboard.

CREATE OR REPLACE FUNCTION fn_purge_soft_deleted_accounts()
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER: precisa apagar em auth.users, schema que o role de
-- execução (cron/service) não tem privilégio de escrita por padrão.
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users
  WHERE id IN (
    SELECT user_id FROM weddings
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
END;
$$;

-- pg_cron pode não estar disponível/autorizado em todo projeto Supabase
-- hospedado (depende de plano/região). Se a extensão não puder ser habilitada
-- aqui, alguém precisa habilitá-la manualmente em Database > Extensions no
-- painel do Supabase e rodar o cron.schedule(...) abaixo uma única vez.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
  RAISE NOTICE 'pg_cron não pôde ser habilitada automaticamente. Habilite manualmente em Database > Extensions no painel do Supabase e rode: SELECT cron.schedule(''purge-soft-deleted-accounts'', ''0 3 * * *'', $cron$SELECT fn_purge_soft_deleted_accounts()$cron$);';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-soft-deleted-accounts',
      '0 3 * * *',
      $cron$SELECT fn_purge_soft_deleted_accounts()$cron$
    );
  END IF;
END $$;
