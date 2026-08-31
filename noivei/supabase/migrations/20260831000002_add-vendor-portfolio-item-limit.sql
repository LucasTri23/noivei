-- Fornecedores — correção do portfólio (auditoria de comparação Fase 1-9): a única
-- checagem de quantidade existente era um teto de LEITURA (PORTFOLIO_ITEM_LIMIT=200
-- em GET /api/v1/vendors/[slug]/portfolio, só uma proteção de query), não um limite
-- de negócio no UPLOAD — nada impedia um fornecedor de subir itens sem fim. Trigger
-- (não só checagem na Route Handler) pra não depender de nenhuma rota nova/futura
-- lembrar de validar isso de novo — mesmo raciocínio da migration anterior.
--
-- 30 itens: teto inicial razoável pra um portfólio de vitrine comercial (não existia
-- decisão de produto anterior pra esse número). Sem infraestrutura de configuração
-- própria pra limites de fornecedor ainda (plan_limits é só do lado casal, amarrado a
-- plano de CASAMENTO) — criar uma tabela de configuração só pra este número seria
-- complexidade desproporcional ao problema; a constante fica aqui, mesmo raciocínio
-- de manter simples já usado no teto fixo de leitura acima.
CREATE OR REPLACE FUNCTION fn_enforce_vendor_portfolio_item_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM vendor_portfolio_items WHERE vendor_id = NEW.vendor_id;

  IF v_count >= 30 THEN
    RAISE EXCEPTION 'vendor_portfolio_item_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_portfolio_items_enforce_limit
  BEFORE INSERT ON vendor_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_vendor_portfolio_item_limit();
