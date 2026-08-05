-- Remove/corrige linhas da tabela de comparação (plan_feature_*, editável em
-- /admin/planos) que descrevem recurso sem implementação real no produto — achado
-- da auditoria técnica desta sessão, mantido pendente até agora por ser conteúdo de
-- marketing (decisão do dono do produto, não algo pra eu decidir sozinho). Autorizado
-- explicitamente no roadmap V1.1, item 1 ("Remover funcionalidades fictícias").
--
-- Removidas por completo (nenhuma implementação encontrada em nenhum plano):
--   IA, Backup (nenhum recurso de IA ou backup existe hoje no produto)
-- Corrigidas (o recurso é real, só a descrição inflava/errava o que faz):
--   Checklist: "Inteligente"/"IA personalizada" -> "Personalizado" (é um motor de
--     regras a partir do questionário do onboarding, não IA)
--   Notificações: "Push"/"Inteligentes" -> "E-mail" (só e-mail existe, sem push)
--   Exportação: renomeada pra refletir o que existe de verdade (JSON completo,
--     LGPD) e liberada pros TRÊS planos (não é diferencial pago)
--   Wedding Score: "IA" no Exclusivo -> ✅ simples (mesmo cálculo do Premium, sem
--     diferenciação real hoje)
--   Dashboard: sem diferença real de código entre planos pagos -> ✅ nos três
--     (removida a distinção "Básico/Completo/Completo + Insights")
--   Remover "Feito com Wednest": nenhuma lógica condicional encontrada no código
--     que esconda esse texto por plano -> linha removida
--
-- Adicionadas (recursos reais, com limite aplicado de verdade em
-- src/lib/billing/check-limit.ts, que não tinham linha nenhuma na tabela):
--   Lançamentos financeiros (categoria Limites)
--   Padrinhos & Entradas (categoria Convidados & site)

DO $$
DECLARE
  feat           UUID;
  cat_limites    UUID;
  cat_convidados UUID;
BEGIN
  SELECT id INTO cat_limites    FROM plan_feature_categories WHERE title = 'Limites' LIMIT 1;
  SELECT id INTO cat_convidados FROM plan_feature_categories WHERE title = 'Convidados & site' LIMIT 1;

  -- Remove por completo: IA e Backup.
  DELETE FROM plan_features
  WHERE category_id IN (SELECT id FROM plan_feature_categories WHERE title = 'Suporte & personalização')
    AND label IN ('IA', 'Backup');

  -- Remove: "Remover Feito com Wednest" (sem implementação encontrada).
  DELETE FROM plan_features
  WHERE label ILIKE '%Feito com Wednest%';

  -- Corrige Checklist.
  SELECT pf.id INTO feat FROM plan_features pf
  JOIN plan_feature_categories pc ON pc.id = pf.category_id
  WHERE pc.title = 'Planejamento' AND pf.label = 'Checklist' LIMIT 1;
  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = '✅'              WHERE feature_id = feat AND group_key = 'free';
    UPDATE plan_feature_values SET value = '✅ Personalizado' WHERE feature_id = feat AND group_key = 'premium';
    UPDATE plan_feature_values SET value = '✅ Personalizado' WHERE feature_id = feat AND group_key = 'plus';
  END IF;

  -- Corrige Notificações.
  SELECT pf.id INTO feat FROM plan_features pf
  JOIN plan_feature_categories pc ON pc.id = pf.category_id
  WHERE pc.title = 'Suporte & personalização' AND pf.label = 'Notificações' LIMIT 1;
  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = '✅ E-mail' WHERE feature_id = feat AND group_key IN ('free', 'premium', 'plus');
  END IF;

  -- Corrige Exportação (renomeia o rótulo e libera pros três planos).
  UPDATE plan_features SET label = 'Exportação completa de dados (LGPD)'
  WHERE label ILIKE 'Exportação%';
  SELECT pf.id INTO feat FROM plan_features pf WHERE pf.label = 'Exportação completa de dados (LGPD)' LIMIT 1;
  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = '✅' WHERE feature_id = feat AND group_key IN ('free', 'premium', 'plus');
  END IF;

  -- Corrige Wedding Score (remove a menção a IA no Exclusivo).
  SELECT pf.id INTO feat FROM plan_features pf
  WHERE pf.label = 'Wedding Score' LIMIT 1;
  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = '✅' WHERE feature_id = feat AND group_key = 'plus';
  END IF;

  -- Corrige Dashboard (sem diferença real entre planos pagos).
  SELECT pf.id INTO feat FROM plan_features pf
  WHERE pf.label = 'Dashboard' LIMIT 1;
  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = '✅' WHERE feature_id = feat AND group_key IN ('free', 'premium', 'plus');
  END IF;

  -- Adiciona: Lançamentos financeiros (limite real, plan_limits.max_financial_entries).
  IF cat_limites IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM plan_features WHERE category_id = cat_limites AND label = 'Lançamentos financeiros'
  ) THEN
    INSERT INTO plan_features (category_id, label, sort_order)
    VALUES (cat_limites, 'Lançamentos financeiros', 3)
    RETURNING id INTO feat;
    INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES
      (feat, 'free',    'Até 15'),
      (feat, 'premium', 'Ilimitado'),
      (feat, 'plus',    'Ilimitado');
  END IF;

  -- Adiciona: Padrinhos & Entradas (limite real, plan_limits.max_wedding_party_entries).
  IF cat_convidados IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM plan_features WHERE category_id = cat_convidados AND label = 'Padrinhos & Entradas'
  ) THEN
    INSERT INTO plan_features (category_id, label, sort_order)
    VALUES (cat_convidados, 'Padrinhos & Entradas', 7)
    RETURNING id INTO feat;
    INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES
      (feat, 'free',    'Até 2'),
      (feat, 'premium', 'Ilimitado'),
      (feat, 'plus',    'Ilimitado');
  END IF;
END $$;
