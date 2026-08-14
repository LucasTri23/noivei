-- Fornecedores — Fase 1: cobrança do fornecedor (R$20/mês ou R$500 vitalício).
--
-- 100% SEPARADA das tabelas de cobrança do CASAL (plans/subscriptions/coupons) — de
-- propósito, por dois bugs reais e latentes que a reutilização acionaria:
--   (a) fn_seed_plan_module_access() dispara em todo INSERT em `plans` e semearia
--       automaticamente linhas de plan_module_access (acesso a MÓDULO DO CASAMENTO)
--       pra qualquer linha de plano de fornecedor inserida na mesma tabela — não faz
--       sentido nenhum pra um plano de fornecedor.
--   (b) coupons.applies_to_plan_id IS NULL significa "vale pra qualquer plano pago"
--       — um cupom coringa do lado casal aplicaria de graça a um plano de fornecedor
--       se os dois vivessem na mesma tabela `plans`.
-- Conclusão: vendor_plans/vendor_subscriptions/vendor_coupons são tabelas paralelas
-- próprias, nunca linhas nas tabelas existentes.
--
-- "Vitalício" copia o MESMO não-padrão já usado no plano único do casal
-- (premium_once): subscription vira status='active' com expires_at = NULL PRA
-- SEMPRE — nada em lugar nenhum lê expires_at pra gating de plano vitalício. Nunca
-- setar expiração, nunca usar data futura fake.

-- =========================================================
-- vendor_plans
-- =========================================================
CREATE TABLE vendor_plans (
  id           TEXT PRIMARY KEY, -- slug livre, mesmo estilo de plans.id: 'vendor_monthly', 'vendor_lifetime'
  name         TEXT NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('monthly', 'lifetime')),
  price_cents  INTEGER NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vendor_plans_updated_at
  BEFORE UPDATE ON vendor_plans
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE vendor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read active vendor plans"
  ON vendor_plans FOR SELECT
  USING (active = true);

CREATE POLICY "admins can manage vendor plans"
  ON vendor_plans FOR ALL
  USING (fn_is_admin(auth.uid()))
  WITH CHECK (fn_is_admin(auth.uid()));

-- R$20,00 e R$500,00 em centavos — mesma convenção de dinheiro-em-centavos já usada
-- em `plans.price_brl` (o nome do preço vitalício "500000" seria centavos de R$5000;
-- R$500,00 = 50000 centavos).
INSERT INTO vendor_plans (id, name, billing_type, price_cents, active, sort_order) VALUES
  ('vendor_monthly',  'Mensal',    'monthly',  2000,  true, 0),
  ('vendor_lifetime', 'Vitalício', 'lifetime', 50000, true, 1);

-- =========================================================
-- vendor_subscriptions
-- =========================================================
CREATE TABLE vendor_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL REFERENCES vendor_plans(id),
  status               TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
  gateway              TEXT CHECK (gateway IN ('mercadopago')),
  gateway_sub_id       TEXT,
  current_period_end   TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ, -- NULL pra sempre no plano vitalício, ver comentário no topo do arquivo
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_subscriptions_vendor_id ON vendor_subscriptions(vendor_id);

CREATE TRIGGER trg_vendor_subscriptions_updated_at
  BEFORE UPDATE ON vendor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE vendor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Só leitura da própria assinatura (histórico de cobrança) — SEM policy de
-- INSERT/UPDATE pra `authenticated` de propósito nenhuma, mesma lição já aprendida e
-- corrigida uma vez pro lado do casal (SEC-01, ver
-- 20260727000003_security-audit-fixes.sql: a policy antiga de subscriptions só
-- checava auth.uid() = user_id, sem restringir plan_id/status, e um client
-- conseguia se auto-conceder qualquer plano pago de graça pra sempre). TODA escrita
-- aqui é service role (webhook do gateway) ou fn_redeem_vendor_coupon abaixo
-- (SECURITY DEFINER) — nunca o client direto, nem pro plano gratuito (não existe
-- plano de fornecedor gratuito).
CREATE POLICY "vendor can read own subscriptions"
  ON vendor_subscriptions FOR SELECT
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "admins can read all vendor subscriptions"
  ON vendor_subscriptions FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- =========================================================
-- vendor_payment_checkouts — uma tentativa de checkout (preference ou preapproval),
-- mesmo desenho de payment_checkouts (mp_reference é gerado por NÓS e mandado como
-- external_reference — única forma segura de o webhook, sem sessão de usuário,
-- saber a qual fornecedor/plano um pagamento pertence).
-- =========================================================
CREATE TABLE vendor_payment_checkouts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  vendor_plan_id       TEXT NOT NULL REFERENCES vendor_plans(id),
  mp_reference         TEXT NOT NULL UNIQUE,
  mp_preference_id     TEXT,
  mp_preapproval_id    TEXT,
  coupon_redemption_id UUID, -- FK adicionada abaixo, depois que vendor_coupon_redemptions existir
  amount_cents         INTEGER NOT NULL,
  discount_cents       INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_payment_checkouts_vendor_id    ON vendor_payment_checkouts(vendor_id);
CREATE INDEX idx_vendor_payment_checkouts_mp_reference ON vendor_payment_checkouts(mp_reference);

CREATE TRIGGER trg_vendor_payment_checkouts_updated_at
  BEFORE UPDATE ON vendor_payment_checkouts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE vendor_payment_checkouts ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de payment_checkouts: leitura só da própria tentativa (tela
-- "processando pagamento"), sem INSERT/UPDATE pra authenticated — toda escrita
-- passa pela API (fase futura) com requireAuth, ou pelo webhook com service role.
CREATE POLICY "vendor can read own payment checkouts"
  ON vendor_payment_checkouts FOR SELECT
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "admins can read all vendor payment checkouts"
  ON vendor_payment_checkouts FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- =========================================================
-- vendor_coupons — espelha a forma ATUAL da tabela `coupons` do casal (inclusive o
-- tipo 'free_days', adicionado depois em 20260723000002), mas 100% separada — ver
-- motivo (a)/(b) no topo do arquivo. applies_to_plan_id aponta pra vendor_plans (só
-- 2 linhas hoje); NULL = vale pra qualquer plano de fornecedor, igual ao
-- comportamento original de `coupons` — aqui isso não é o bug (o bug era о
-- vazamento ENTRE as tabelas do casal e do fornecedor; dentro de uma tabela só de
-- fornecedor, "qualquer plano de fornecedor" é a semântica pretendida mesmo).
-- =========================================================
CREATE TABLE vendor_coupons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  discount_type      TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_days')),
  discount_value     INTEGER, -- percent: 1-100; fixed: centavos; NULL quando free_days
  applies_to_plan_id TEXT REFERENCES vendor_plans(id) ON DELETE CASCADE,
  benefit_days       INTEGER, -- só quando discount_type = 'free_days'
  max_redemptions    INTEGER, -- NULL = sem limite de usos
  redemption_count   INTEGER NOT NULL DEFAULT 0,
  valid_from         TIMESTAMPTZ,
  valid_until        TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_coupons_discount_value_check
    CHECK (discount_type = 'free_days' OR (discount_value IS NOT NULL AND discount_value > 0)),
  CONSTRAINT vendor_coupons_percent_max_check
    CHECK (discount_type != 'percent' OR discount_value <= 100),
  CONSTRAINT vendor_coupons_free_days_requires_plan_check
    CHECK (discount_type != 'free_days' OR (applies_to_plan_id IS NOT NULL AND benefit_days IS NOT NULL AND benefit_days > 0))
);

CREATE TRIGGER trg_vendor_coupons_updated_at
  BEFORE UPDATE ON vendor_coupons
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE vendor_coupons ENABLE ROW LEVEL SECURITY;

-- Sem SELECT pública de propósito (diferente de vendor_plans/plans): código de
-- cupom é digitado manualmente pelo fornecedor, não navegado numa listagem — igual
-- ao `coupons` do casal. Admin-only pras 4 operações (mesmo padrão de 4 policies
-- separadas que `coupons` original usa, não FOR ALL).
CREATE POLICY "admins can read vendor coupons"   ON vendor_coupons FOR SELECT USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can insert vendor coupons" ON vendor_coupons FOR INSERT WITH CHECK (fn_is_admin(auth.uid()));
CREATE POLICY "admins can update vendor coupons" ON vendor_coupons FOR UPDATE USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can delete vendor coupons" ON vendor_coupons FOR DELETE USING (fn_is_admin(auth.uid()));

-- =========================================================
-- vendor_coupon_redemptions — espelha coupon_redemptions (que hoje já inclui
-- applied_at, adicionado em 20260727000001_apply-coupon-discounts-to-checkout.sql:
-- redeemed_at = quando o RPC validou/reservou o cupom; applied_at = quando o
-- pagamento foi de fato aprovado pelo webhook — fica NULL até lá, nunca setado por
-- este arquivo (webhook é fase futura). Se o checkout for abandonado, o cupom
-- continua disponível (não foi "gasto", só reservado).
--
-- DECISÃO — UNIQUE(coupon_id, vendor_id), não (coupon_id, user_id): quem resgata é
-- o NEGÓCIO (a linha de vendor_profiles), não uma conta de usuário qualquer — é o
-- fornecedor quem tem a assinatura (vendor_subscriptions.vendor_id, nunca
-- .user_id), então o dedup de "já resgatou este cupom" precisa acompanhar a mesma
-- entidade que é cobrada. Hoje user_id e vendor_id são efetivamente 1:1
-- (vendor_profiles.user_id é UNIQUE), mas se uma transferência de titularidade de
-- fornecedor virar feature no futuro, vendor_id continua correto e user_id não.
-- =========================================================
CREATE TABLE vendor_coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES vendor_coupons(id) ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at  TIMESTAMPTZ,
  UNIQUE (coupon_id, vendor_id)
);

CREATE INDEX idx_vendor_coupon_redemptions_vendor_id ON vendor_coupon_redemptions(vendor_id);

ALTER TABLE vendor_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor can read own coupon redemptions"
  ON vendor_coupon_redemptions FOR SELECT
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "admins can read all vendor coupon redemptions"
  ON vendor_coupon_redemptions FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Sem policy de INSERT/UPDATE pra `authenticated` de propósito: todo resgate passa
-- por fn_redeem_vendor_coupon() (SECURITY DEFINER) abaixo — client nunca insere
-- direto em vendor_coupons/vendor_coupon_redemptions/vendor_subscriptions.

ALTER TABLE vendor_payment_checkouts
  ADD CONSTRAINT vendor_payment_checkouts_coupon_redemption_id_fkey
    FOREIGN KEY (coupon_redemption_id) REFERENCES vendor_coupon_redemptions(id);

-- Resgate de verdade (grava), espelhando fn_redeem_coupon() (20260723000002) —
-- mesmo padrão de lock (SELECT ... FOR UPDATE evita corrida entre duas chamadas
-- simultâneas do mesmo código perto do limite de usos) + segurança dupla da UNIQUE
-- constraint (coupon_id, vendor_id). Callable via RPC por um fornecedor autenticado
-- sem precisar de nenhuma grant direta nas tabelas.
CREATE OR REPLACE FUNCTION fn_redeem_vendor_coupon(p_code TEXT, p_vendor_id UUID)
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
  v_coupon vendor_coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon FROM vendor_coupons c
  WHERE c.code = upper(p_code)
    AND c.is_active = TRUE
    AND (c.valid_from IS NULL OR c.valid_from <= NOW())
    AND (c.valid_until IS NULL OR c.valid_until >= NOW())
    AND (c.max_redemptions IS NULL OR c.redemption_count < c.max_redemptions)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM vendor_coupon_redemptions cr WHERE cr.coupon_id = v_coupon.id AND cr.vendor_id = p_vendor_id) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  INSERT INTO vendor_coupon_redemptions (coupon_id, vendor_id) VALUES (v_coupon.id, p_vendor_id);
  UPDATE vendor_coupons SET redemption_count = redemption_count + 1 WHERE id = v_coupon.id;

  -- free_days funciona de verdade sem depender de gateway nenhum, mesmo não-padrão
  -- de fn_redeem_coupon: concede/estende vendor_subscriptions diretamente.
  IF v_coupon.discount_type = 'free_days' THEN
    IF EXISTS (SELECT 1 FROM vendor_subscriptions s WHERE s.vendor_id = p_vendor_id AND s.status = 'active') THEN
      UPDATE vendor_subscriptions
        SET plan_id = v_coupon.applies_to_plan_id, status = 'active',
            expires_at = NOW() + make_interval(days => v_coupon.benefit_days)
        WHERE vendor_id = p_vendor_id AND status = 'active';
    ELSE
      INSERT INTO vendor_subscriptions (vendor_id, plan_id, status, expires_at)
      VALUES (p_vendor_id, v_coupon.applies_to_plan_id, 'active', NOW() + make_interval(days => v_coupon.benefit_days));
    END IF;
  END IF;

  RETURN QUERY SELECT v_coupon.discount_type, v_coupon.discount_value, v_coupon.applies_to_plan_id, v_coupon.benefit_days;
END;
$$;

-- =========================================================
-- Visibilidade pública centralizada — "este fornecedor deve aparecer no marketplace
-- público / perfil público?" NUNCA duplicar esta regra em outro lugar (RLS ou
-- código); toda checagem de "é público" passa por aqui. Só pode ser criada AQUI (não
-- na migration de identidade) porque depende de vendor_subscriptions, que só passou
-- a existir acima.
-- =========================================================
CREATE OR REPLACE FUNCTION fn_vendor_is_publicly_visible(p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vendor_profiles vp
    WHERE vp.id = p_vendor_id
      AND vp.status = 'active'
      AND vp.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM vendor_subscriptions vs
        WHERE vs.vendor_id = p_vendor_id
          AND vs.status = 'active'
          AND (vs.expires_at IS NULL OR vs.expires_at > NOW())
      )
  );
$$;

-- ── Leitura pública, adiada da migration de identidade até aqui existir ──
CREATE POLICY "public can read publicly visible vendor profiles"
  ON vendor_profiles FOR SELECT
  USING (fn_vendor_is_publicly_visible(id));

CREATE POLICY "public can read publicly visible vendor category links"
  ON vendor_category_links FOR SELECT
  USING (fn_vendor_is_publicly_visible(vendor_id));

CREATE POLICY "public can read publicly visible vendor portfolio items"
  ON vendor_portfolio_items FOR SELECT
  USING (fn_vendor_is_publicly_visible(vendor_id));
