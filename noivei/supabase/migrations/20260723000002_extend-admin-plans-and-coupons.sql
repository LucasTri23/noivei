-- Completa o painel admin (20260722000006) com as duas peças que ainda faltavam:
-- 1) tabela de comparação de recursos editável (hoje hardcoded em plan-selector.tsx);
-- 2) cupom do tipo "dias grátis de um plano" (hoje só existe percent/fixed, inertes
--    até existir gateway de pagamento — free_days funciona de verdade, sem depender
--    de cobrança nenhuma).

-- ── Tabela de comparação de recursos ──
-- group_key usa os mesmos 3 identificadores ('free'/'premium'/'plus') já usados como
-- chave dos cards em plan-selector.tsx — não depende de nenhuma coluna nova em
-- `plans` (premium/plus já colapsam variantes monthly/once no mesmo card no código).

CREATE TABLE IF NOT EXISTS plan_feature_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES plan_feature_categories(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_feature_values (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES plan_features(id) ON DELETE CASCADE,
  group_key  TEXT NOT NULL CHECK (group_key IN ('free', 'premium', 'plus')),
  value      TEXT NOT NULL DEFAULT '❌',
  UNIQUE (feature_id, group_key)
);

ALTER TABLE plan_feature_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_feature_values     ENABLE ROW LEVEL SECURITY;

-- Conteúdo de marketing, mesmo padrão de leitura aberta de plan_limits. Escrita usa
-- fn_is_admin() (20260722000006) — mesma function das outras policies do painel,
-- evita duplicar a lógica com sintaxe diferente e evita reintroduzir o bug de
-- recursão corrigido em 20260722000008 (uma policy em `profiles` que consulta
-- `profiles` direto); fn_is_admin() é SECURITY DEFINER e não sofre disso.
DROP POLICY IF EXISTS "anyone can read plan feature categories" ON plan_feature_categories;
CREATE POLICY "anyone can read plan feature categories" ON plan_feature_categories FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "admins can manage plan feature categories" ON plan_feature_categories;
CREATE POLICY "admins can manage plan feature categories" ON plan_feature_categories FOR ALL
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));

DROP POLICY IF EXISTS "anyone can read plan features" ON plan_features;
CREATE POLICY "anyone can read plan features" ON plan_features FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "admins can manage plan features" ON plan_features;
CREATE POLICY "admins can manage plan features" ON plan_features FOR ALL
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));

DROP POLICY IF EXISTS "anyone can read plan feature values" ON plan_feature_values;
CREATE POLICY "anyone can read plan feature values" ON plan_feature_values FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "admins can manage plan feature values" ON plan_feature_values;
CREATE POLICY "admins can manage plan feature values" ON plan_feature_values FOR ALL
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));

-- Seed 1:1 do que está hardcoded em plan-selector.tsx (array CATEGORIES) — só roda se
-- a tabela ainda estiver vazia, pra migration poder rodar de novo sem duplicar linhas.
DO $$
DECLARE
  cat_limites      UUID;
  cat_planejamento UUID;
  cat_convidados   UUID;
  cat_suporte      UUID;
  feat             UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM plan_feature_categories LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO plan_feature_categories (title, sort_order) VALUES ('Limites', 0) RETURNING id INTO cat_limites;
  INSERT INTO plan_feature_categories (title, sort_order) VALUES ('Planejamento', 1) RETURNING id INTO cat_planejamento;
  INSERT INTO plan_feature_categories (title, sort_order) VALUES ('Convidados & site', 2) RETURNING id INTO cat_convidados;
  INSERT INTO plan_feature_categories (title, sort_order) VALUES ('Suporte & personalização', 3) RETURNING id INTO cat_suporte;

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_limites, 'Usuários', 0) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '1'), (feat, 'premium', 'Até 5'), (feat, 'plus', 'Até 10');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_limites, 'Convidados', 1) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Até 50'), (feat, 'premium', 'Até 250'), (feat, 'plus', 'Ilimitados');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_limites, 'Upload de contratos', 2) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '100 MB'), (feat, 'premium', '5 GB'), (feat, 'plus', '20 GB');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_planejamento, 'Checklist', 0) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '✅'), (feat, 'premium', '✅ Inteligente'), (feat, 'plus', '✅ IA personalizada');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_planejamento, 'Timeline', 1) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '✅'), (feat, 'premium', '✅'), (feat, 'plus', '✅');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_planejamento, 'Dashboard', 2) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Básico'), (feat, 'premium', 'Completo'), (feat, 'plus', 'Completo + Insights');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_planejamento, 'Wedding Score', 3) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅ IA');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_planejamento, 'Financeiro', 4) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Básico'), (feat, 'premium', 'Completo'), (feat, 'plus', 'Completo + relatórios avançados');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_convidados, 'RSVP', 0) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Até 50 confirmações'), (feat, 'premium', 'Ilimitado'), (feat, 'plus', 'Ilimitado');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_convidados, 'Site do casal', 1) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅ Domínio próprio (futuro)');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_convidados, 'Lista de presentes', 2) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_convidados, 'Organização de mesas', 3) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅ Distribuição automática');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Notificações', 0) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Básicas'), (feat, 'premium', 'Email + Push'), (feat, 'plus', 'Inteligentes');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'IA', 1) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', 'Sugestões básicas'), (feat, 'plus', 'Assistente completo');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Suporte', 2) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'FAQ'), (feat, 'premium', 'Email'), (feat, 'plus', 'Prioritário');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Exportação PDF/Excel', 3) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Personalização', 4) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', 'Básica'), (feat, 'premium', 'Média'), (feat, 'plus', 'Completa');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Remover "Feito com Wednest"', 5) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', '✅'), (feat, 'plus', '✅');

  INSERT INTO plan_features (category_id, label, sort_order) VALUES (cat_suporte, 'Backup', 6) RETURNING id INTO feat;
  INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES (feat, 'free', '❌'), (feat, 'premium', 'Automático'), (feat, 'plus', 'Avançado');
END $$;

-- ── Cupons: novo tipo 'free_days' (concede um plano de graça por N dias, sem
-- depender de gateway de pagamento nenhum — diferente de percent/fixed, que ficam
-- inertes até existir cobrança real) ──

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS benefit_days INTEGER,
  ALTER COLUMN discount_value DROP NOT NULL;

-- Os CHECK de coupons foram criados sem nome (auto-gerados) na migration original —
-- em vez de adivinhar o nome exato, remove todos os CHECK da tabela por introspecção
-- e recria do zero. Idempotente: rodar de novo só recria os mesmos.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN SELECT conname FROM pg_constraint WHERE conrelid = 'coupons'::regclass AND contype = 'c' LOOP
    EXECUTE format('ALTER TABLE coupons DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_discount_type_check
    CHECK (discount_type IN ('percent', 'fixed', 'free_days')),
  ADD CONSTRAINT coupons_discount_value_check
    CHECK (discount_type = 'free_days' OR (discount_value IS NOT NULL AND discount_value > 0)),
  ADD CONSTRAINT coupons_percent_max_check
    CHECK (discount_type != 'percent' OR discount_value <= 100),
  ADD CONSTRAINT coupons_free_days_requires_plan_check
    CHECK (discount_type != 'free_days' OR (applies_to_plan_id IS NOT NULL AND benefit_days IS NOT NULL AND benefit_days > 0));

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own coupon redemptions" ON coupon_redemptions;
CREATE POLICY "users can read own coupon redemptions" ON coupon_redemptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins can read all coupon redemptions" ON coupon_redemptions;
CREATE POLICY "admins can read all coupon redemptions" ON coupon_redemptions FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Sem policy de INSERT/UPDATE pra `authenticated` de propósito: todo o resgate passa
-- por fn_redeem_coupon() (SECURITY DEFINER) abaixo, que valida tudo atomicamente
-- (código ativo, dentro da validade, limite de usos, resgate único por usuário) antes
-- de gravar — client nunca insere direto em coupons/coupon_redemptions/subscriptions.

-- fn_validate_coupon() (20260722000006) ainda serve pra uma pré-checagem read-only
-- sem consumir o cupom; passa a incluir benefit_days pro tipo free_days. Postgres não
-- deixa CREATE OR REPLACE mudar o formato das colunas de retorno (RETURNS TABLE) de
-- uma function já existente — precisa dropar antes (era 4 colunas, agora são 5).
DROP FUNCTION IF EXISTS fn_validate_coupon(TEXT);
CREATE OR REPLACE FUNCTION fn_validate_coupon(p_code TEXT)
RETURNS TABLE (
  id                 UUID,
  discount_type      TEXT,
  discount_value     INTEGER,
  applies_to_plan_id TEXT,
  benefit_days       INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id, c.discount_type, c.discount_value, c.applies_to_plan_id, c.benefit_days
  FROM coupons c
  WHERE c.code = upper(p_code)
    AND c.is_active = TRUE
    AND (c.valid_from IS NULL OR c.valid_from <= NOW())
    AND (c.valid_until IS NULL OR c.valid_until >= NOW())
    AND (c.max_redemptions IS NULL OR c.redemption_count < c.max_redemptions);
$$;

-- Resgate de verdade (grava): valida tudo de novo sob lock (evita corrida entre duas
-- chamadas simultâneas do mesmo código perto do limite de usos), registra o resgate,
-- incrementa o contador e — só para free_days — concede o plano em `subscriptions`.
-- Mensagens de erro em snake_case simples (não é um "erro interno", é esperado o
-- client tratar cada uma) — a rota de API traduz pra HTTP/pt-BR.
DROP FUNCTION IF EXISTS fn_redeem_coupon(TEXT, UUID);
CREATE OR REPLACE FUNCTION fn_redeem_coupon(p_code TEXT, p_user_id UUID)
RETURNS TABLE (
  discount_type      TEXT,
  discount_value     INTEGER,
  applies_to_plan_id TEXT,
  benefit_days       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon FROM coupons c
  WHERE c.code = upper(p_code)
    AND c.is_active = TRUE
    AND (c.valid_from IS NULL OR c.valid_from <= NOW())
    AND (c.valid_until IS NULL OR c.valid_until >= NOW())
    AND (c.max_redemptions IS NULL OR c.redemption_count < c.max_redemptions)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM coupon_redemptions cr WHERE cr.coupon_id = v_coupon.id AND cr.user_id = p_user_id) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  INSERT INTO coupon_redemptions (coupon_id, user_id) VALUES (v_coupon.id, p_user_id);
  UPDATE coupons SET redemption_count = redemption_count + 1 WHERE id = v_coupon.id;

  IF v_coupon.discount_type = 'free_days' THEN
    IF EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = p_user_id AND s.status = 'active') THEN
      UPDATE subscriptions
        SET plan_id = v_coupon.applies_to_plan_id, status = 'active',
            expires_at = NOW() + make_interval(days => v_coupon.benefit_days)
        WHERE user_id = p_user_id AND status = 'active';
    ELSE
      INSERT INTO subscriptions (user_id, plan_id, status, expires_at)
      VALUES (p_user_id, v_coupon.applies_to_plan_id, 'active', NOW() + make_interval(days => v_coupon.benefit_days));
    END IF;
  END IF;

  RETURN QUERY SELECT v_coupon.discount_type, v_coupon.discount_value, v_coupon.applies_to_plan_id, v_coupon.benefit_days;
END;
$$;
