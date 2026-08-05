-- fn_purge_soft_deleted_accounts() (20260703000009) ainda usava INTERVAL '30 days'
-- fixo em SQL, mesmo depois de account_purge_days virar configurável em
-- app_settings (20260805000002) e a rotina de cron (purge-accounts/route.ts)
-- passar a calcular a janela de limpeza do Storage dinamicamente a partir dele.
-- Sem esta migration, mudar o valor em /admin/configuracoes só adiantaria/atrasaria
-- a limpeza do STORAGE — o cascade real em auth.users (que apaga o resto: weddings
-- e tudo em cascata) continuaria sempre nos mesmos 30 dias fixos, reabrindo
-- exatamente o bug de arquivo órfão que a rotina foi corrigida pra evitar: se o
-- admin configurar um prazo MAIOR que 30, o cascade apagaria a conta do banco antes
-- do Storage daquele casamento ter sido limpo nesta execução (só seleciona
-- casamentos mais antigos que o prazo configurado); se configurar um prazo MENOR,
-- o Storage seria limpo antes da conta sumir de fato do banco.
--
-- DROP explícito porque mudar de fn_purge_soft_deleted_accounts() (zero parâmetros)
-- pra fn_purge_soft_deleted_accounts(p_purge_days INTEGER DEFAULT 30) é uma
-- assinatura diferente pro Postgres (CREATE OR REPLACE não troca a função no lugar
-- quando a lista de parâmetros muda) — sem o DROP, as duas versões coexistiriam.
-- O parâmetro tem DEFAULT 30 só por segurança (qualquer chamada antiga que não
-- passe o argumento continua funcionando com o mesmo valor de sempre); a rotina de
-- cron sempre passa o valor de account_purge_days explicitamente a partir de agora,
-- garantindo que Storage e banco usem a MESMA janela em cada execução.
DROP FUNCTION IF EXISTS fn_purge_soft_deleted_accounts();

CREATE FUNCTION fn_purge_soft_deleted_accounts(p_purge_days INTEGER DEFAULT 30)
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
  );
END;
$$;
