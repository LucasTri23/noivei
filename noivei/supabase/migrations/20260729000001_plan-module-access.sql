-- Acesso a MÓDULO por PLANO, editável no admin (não mais hardcoded em código).
--
-- Até aqui, "quais módulos cada plano libera" vivia espalhado e hardcoded em 3
-- lugares desalinhados: PaywallGate.FEATURES (só 4 módulos, sempre 'premium'),
-- Sidebar/MobileBottomNav.pro (as mesmas 4 chaves, duplicadas) — trocar isso exigia
-- deploy. Esta migration cria uma tabela normalizada (mesmo espírito de plan_limits,
-- que já é 100% editável no admin) pra decidir isso, e o código (PaywallGate) passa
-- a consultar essa tabela em vez de comparar plan_id contra listas fixas.

CREATE TABLE plan_module_access (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module  TEXT NOT NULL CHECK (module IN (
    'checklist', 'convidados', 'financeiro', 'mesas',
    'site', 'arquivos', 'presentes', 'padrinhos'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (plan_id, module)
);

ALTER TABLE plan_module_access ENABLE ROW LEVEL SECURITY;

-- Não é informação sensível (só "este plano libera este módulo?") — leitura aberta,
-- mesmo padrão de plan_limits/plan_feature_*. Escrita só admin.
CREATE POLICY "anyone can read plan module access" ON plan_module_access FOR SELECT USING (TRUE);
CREATE POLICY "admins can manage plan module access" ON plan_module_access FOR ALL
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));

-- Seed: reproduz EXATAMENTE o comportamento hardcoded de hoje, pra não mudar nada na
-- hora de aplicar esta migration — checklist/convidados/financeiro/padrinhos sempre
-- liberados (nunca tiveram PaywallGate); mesas/site/arquivos/presentes só em plano
-- pago (price_brl > 0), igual PaywallGate.FEATURES exigia hoje ('premium', nunca
-- 'premium_plus' — nenhum recurso usava esse nível na prática).
INSERT INTO plan_module_access (plan_id, module, enabled)
SELECT
  p.id,
  m.module,
  CASE
    WHEN m.module IN ('mesas', 'site', 'arquivos', 'presentes') THEN p.price_brl > 0
    ELSE true
  END
FROM plans p
CROSS JOIN (
  VALUES ('checklist'), ('convidados'), ('financeiro'), ('mesas'),
         ('site'), ('arquivos'), ('presentes'), ('padrinhos')
) AS m(module)
ON CONFLICT (plan_id, module) DO NOTHING;

-- Todo plano NOVO criado depois (via /admin/planos) começa com o mesmo padrão
-- default acima — sem isso, um plano recém-criado ficaria sem nenhuma linha em
-- plan_module_access, e PaywallGate trata "sem linha" como liberado (fail-open),
-- o que faria um plano Gratuito novo nascer com mesas/site/arquivos/presentes
-- liberados por engano até o admin configurar manualmente.
CREATE OR REPLACE FUNCTION fn_seed_plan_module_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO plan_module_access (plan_id, module, enabled)
  SELECT
    NEW.id,
    m.module,
    CASE
      WHEN m.module IN ('mesas', 'site', 'arquivos', 'presentes') THEN NEW.price_brl > 0
      ELSE true
    END
  FROM (
    VALUES ('checklist'), ('convidados'), ('financeiro'), ('mesas'),
           ('site'), ('arquivos'), ('presentes'), ('padrinhos')
  ) AS m(module)
  ON CONFLICT (plan_id, module) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_plans_seed_module_access
  AFTER INSERT ON plans
  FOR EACH ROW EXECUTE FUNCTION fn_seed_plan_module_access();
