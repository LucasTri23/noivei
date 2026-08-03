-- Módulo Check-in (Fase "ingresso com QR code" / controle de entrada no dia do
-- casamento) — estende o sistema de plan_module_access criado em
-- 20260729000001 com uma 9ª chave, 'checkin', sem editar a migration original.
--
-- Diferente dos demais módulos pagos (mesas/site/arquivos/presentes, liberados
-- em QUALQUER plano pago), o check-in é reservado só para o plano mais caro
-- ativo no momento desta migration — o admin pode reconfigurar depois em
-- /admin/planos/modulos (mesma tela dos outros módulos, sem código novo).

-- O CHECK original (migration 20260729000001) foi declarado inline na coluna,
-- sem nome explícito — o Postgres teria nomeado como <tabela>_<coluna>_check
-- (plan_module_access_module_check) por convenção, mas em vez de confiar cegamente
-- nisso, descobre o nome de verdade em pg_constraint (qualquer CHECK que mencione
-- a coluna `module`) e o remove por esse nome antes de recriar com a 9ª opção —
-- assim esta migration não quebra mesmo se o nome real divergir da convenção.
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
  'site', 'arquivos', 'presentes', 'padrinhos', 'checkin'
));

-- Seed dos planos JÁ EXISTENTES: liberado só para quem tem o maior price_brl
-- entre os planos ativos hoje — "só para o plano mais caro", sem hardcodar
-- nenhum plan_id (o catálogo de planos é dinâmico/editável pelo admin).
INSERT INTO plan_module_access (plan_id, module, enabled)
SELECT
  p.id,
  'checkin',
  -- COALESCE(..., false) é só uma defesa contra o caso patológico de não existir
  -- NENHUM plano ativo no momento desta migration (MAX() viraria NULL, e a coluna
  -- `enabled` é NOT NULL) — não deveria acontecer na prática (o plano Gratuito
  -- nasce ativo), mas evita que a migration falhe se acontecer.
  COALESCE(p.price_brl = (SELECT MAX(price_brl) FROM plans WHERE is_active = true), false)
FROM plans p
ON CONFLICT (plan_id, module) DO NOTHING;

-- Todo plano NOVO criado depois começa SEM check-in (diferente dos outros
-- módulos pagos, que nascem `true` para qualquer plano pago) — é o admin quem
-- decide manualmente, por plano, quando quiser liberar este recurso.
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
      WHEN m.module = 'checkin' THEN false
      WHEN m.module IN ('mesas', 'site', 'arquivos', 'presentes') THEN NEW.price_brl > 0
      ELSE true
    END
  FROM (
    VALUES ('checklist'), ('convidados'), ('financeiro'), ('mesas'),
           ('site'), ('arquivos'), ('presentes'), ('padrinhos'), ('checkin')
  ) AS m(module)
  ON CONFLICT (plan_id, module) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ticket de check-in (guests.checked_in_at): timestamp de chegada no dia do
-- casamento, preenchido pela rota de validação do QR code. NULL = ainda não
-- chegou. Sem índice de propósito: a contagem "X de Y chegaram" na tela de
-- scanner é um count() sequencial sobre os convidados de UM casamento (poucas
-- centenas/milhares de linhas) — mesma escala já aceita hoje em checkGuestLimit
-- e afins, sem índice dedicado.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
