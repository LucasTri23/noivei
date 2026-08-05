-- Módulo "Wedding Score" (roadmap item 2: versão completa, com 7 categorias e pesos
-- configuráveis) — estende plan_module_access com uma 11ª chave, 'wedding_score',
-- sem editar nenhuma migration existente (mesmo padrão de 20260801000001/checkin e
-- 20260803000001/album).
--
-- Diferente da versão simples de hoje (liberada em QUALQUER plano pago via
-- isPaidPlan()), a versão completa é reservada só ao plano ATIVO mais caro no
-- momento desta migration — o admin pode reconfigurar depois em
-- /admin/planos/modulos (mesma tela dos outros módulos, sem código novo), então
-- "mais caro" aqui é só o valor inicial, não uma regra fixa em código.

-- Descobre o nome real da CHECK constraint em pg_constraint em vez de supor o nome
-- por convenção (mesma técnica das duas migrations anteriores que estenderam esta
-- lista) — assim esta migration não quebra mesmo se o nome real divergir.
DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO existing_constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'plan_module_access'::regclass
    AND con.contype = 'c'
    AND att.attname = 'module';

  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE plan_module_access DROP CONSTRAINT %I', existing_constraint_name);
  END IF;
END $$;

ALTER TABLE plan_module_access ADD CONSTRAINT plan_module_access_module_check CHECK (module IN (
  'checklist', 'convidados', 'financeiro', 'mesas',
  'site', 'arquivos', 'presentes', 'padrinhos', 'checkin', 'album', 'wedding_score'
));

-- Seed dos planos JÁ EXISTENTES: liberado só para quem tem o maior price_brl entre
-- os planos ativos hoje, sem hardcodar nenhum plan_id.
INSERT INTO plan_module_access (plan_id, module, enabled)
SELECT
  p.id,
  'wedding_score',
  COALESCE(p.price_brl = (SELECT MAX(price_brl) FROM plans WHERE is_active = true), false)
FROM plans p
ON CONFLICT (plan_id, module) DO NOTHING;

-- Todo plano NOVO criado depois começa SEM wedding_score (mesmo tratamento de
-- checkin/album, os outros dois módulos "exclusivos do topo de linha") — é o admin
-- quem decide manualmente, por plano, quando quiser liberar este recurso.
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
      WHEN m.module IN ('checkin', 'album', 'wedding_score') THEN false
      WHEN m.module IN ('mesas', 'site', 'arquivos', 'presentes') THEN NEW.price_brl > 0
      ELSE true
    END
  FROM (
    VALUES ('checklist'), ('convidados'), ('financeiro'), ('mesas'),
           ('site'), ('arquivos'), ('presentes'), ('padrinhos'), ('checkin'), ('album'),
           ('wedding_score')
  ) AS m(module)
  ON CONFLICT (plan_id, module) DO NOTHING;

  RETURN NEW;
END;
$$;
