-- Achado da revisão dos documentos legais (LGPD, direito à eliminação, art. 18 VI):
-- fn_purge_soft_deleted_accounts() (20260703000009) só apaga linhas do banco —
-- storage.objects não tem FK/cascade com as tabelas da aplicação, então os
-- ARQUIVOS de verdade (fotos, contratos, documentos) ficavam órfãos no Storage
-- pra sempre depois do expurgo, mesmo com a linha de metadados apagada.
--
-- A limpeza do Storage só é possível via API do Supabase Storage (fora do
-- Postgres) — ver /api/cron/purge-accounts, que agora faz essa limpeza e só
-- depois chama fn_purge_soft_deleted_accounts() via RPC, nessa ordem.
--
-- Por isso o agendamento INTERNO do pg_cron precisa parar: se ele continuasse
-- rodando em paralelo com o cron do Vercel, corria o risco de apagar as linhas do
-- banco ANTES da rota conseguir limpar o Storage (a rota depende de encontrar o
-- wedding_id ainda presente em `weddings` pra saber qual pasta apagar) — exatamente
-- o bug que estamos corrigindo aconteceria de novo, só que de forma intermitente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-soft-deleted-accounts');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Job pode não existir (ex.: pg_cron nunca foi habilitado neste projeto,
  -- como a migration original já previa) — nada a fazer nesse caso.
  NULL;
END $$;
