-- Fornecedores — correção obrigatória de LGPD/expurgo (auditoria de comparação Fase
-- 1-9): fn_purge_soft_deleted_accounts() (20260805000004) só seleciona auth.users
-- via `weddings.deleted_at` — uma conta 100% fornecedor (sem casamento nenhum, ver
-- decisão de conta híbrida em 20260806000002) nunca era selecionada, então nunca
-- era expurgada, mesmo marcada como "excluída". Mesma assinatura
-- (p_purge_days INTEGER DEFAULT 30) do CREATE OR REPLACE anterior — não precisa de
-- DROP porque a lista de parâmetros não muda desta vez.
--
-- NÃO cobre por si só a limpeza do bucket "vendor-portfolio" (isso é
-- responsabilidade de /api/cron/purge-accounts, que precisa rodar ANTES deste RPC —
-- mesma ordem já estabelecida pro lado do casal, ver comentário no topo da rota).
CREATE OR REPLACE FUNCTION fn_purge_soft_deleted_accounts(p_purge_days INTEGER DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users
  WHERE id IN (
    SELECT user_id FROM weddings
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - make_interval(days => p_purge_days)
    UNION
    SELECT user_id FROM vendor_profiles
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - make_interval(days => p_purge_days)
  );
END;
$$;
