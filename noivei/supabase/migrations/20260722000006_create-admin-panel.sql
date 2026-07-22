-- Painel administrativo: dono do produto (não do casamento) define preço dos planos,
-- limites por feature, e cupons de desconto; e acompanha quantos usuários/casamentos
-- existem. Não existe fluxo de cadastro de admin — vira admin quem o próprio dono do
-- produto promover manualmente via SQL (ver instrução no fim deste arquivo), nunca
-- pela própria aplicação (evita qualquer caminho de auto-promoção).
--
-- profiles.role já existia com CHECK IN ('user','admin','support') desde a migration
-- de profiles, e já havia uma policy "admins can read all profiles" antecipando isto
-- — mas nada mais no projeto usava 'admin' até agora.
--
-- fn_is_admin() seguindo o mesmo padrão de fn_is_wedding_member()/fn_has_module_access()
-- (SECURITY DEFINER, SET search_path) — evita repetir o EXISTS em toda policy nova.

CREATE OR REPLACE FUNCTION fn_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin'
  );
$$;

-- =========================================================
-- plans / plan_limits — admin pode escrever; leitura pública já existia
-- =========================================================
CREATE POLICY "admins can insert plans" ON plans FOR INSERT WITH CHECK (fn_is_admin(auth.uid()));
CREATE POLICY "admins can update plans" ON plans FOR UPDATE USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can delete plans" ON plans FOR DELETE USING (fn_is_admin(auth.uid()));

CREATE POLICY "admins can insert plan limits" ON plan_limits FOR INSERT WITH CHECK (fn_is_admin(auth.uid()));
CREATE POLICY "admins can update plan limits" ON plan_limits FOR UPDATE USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can delete plan limits" ON plan_limits FOR DELETE USING (fn_is_admin(auth.uid()));

-- =========================================================
-- Leitura administrativa de weddings/subscriptions (dashboard, lista de usuários)
-- =========================================================
CREATE POLICY "admins can read all weddings"
  ON weddings FOR SELECT
  USING (fn_is_admin(auth.uid()));

CREATE POLICY "admins can read all subscriptions"
  ON subscriptions FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- =========================================================
-- coupons — cupom de desconto. Sem gateway de pagamento real integrado ainda (ver
-- TODO Fase 2 em plan-selector.tsx), então por enquanto é só cadastro/gestão do lado
-- do admin: a aplicação de cupom no checkout do casal fica para quando o pagamento de
-- verdade existir. Nenhuma policy de SELECT pra usuário comum de propósito — a
-- validação de um código (quando o fluxo de checkout existir) passa por
-- fn_validate_coupon() abaixo (SECURITY DEFINER), que expõe só o mínimo (tipo/valor
-- do desconto), nunca a tabela inteira com todos os códigos e contagens de uso.
-- =========================================================
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value    INTEGER NOT NULL CHECK (discount_value > 0), -- percent: 1-100; fixed: centavos
  applies_to_plan_id TEXT REFERENCES plans(id) ON DELETE CASCADE, -- NULL = vale pra qualquer plano pago
  max_redemptions   INTEGER,                                     -- NULL = sem limite de usos
  redemption_count  INTEGER NOT NULL DEFAULT 0,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (discount_type != 'percent' OR discount_value <= 100)
);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read coupons"   ON coupons FOR SELECT USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can insert coupons" ON coupons FOR INSERT WITH CHECK (fn_is_admin(auth.uid()));
CREATE POLICY "admins can update coupons" ON coupons FOR UPDATE USING (fn_is_admin(auth.uid()));
CREATE POLICY "admins can delete coupons" ON coupons FOR DELETE USING (fn_is_admin(auth.uid()));

-- Valida um código de cupom sem expor a tabela inteira (código de outros cupons,
-- contagem de uso etc.) pro usuário comum — retorna vazio se o código não existe,
-- estiver inativo, fora da janela de validade, ou tiver esgotado os usos.
CREATE OR REPLACE FUNCTION fn_validate_coupon(p_code TEXT)
RETURNS TABLE (
  id                 UUID,
  discount_type      TEXT,
  discount_value     INTEGER,
  applies_to_plan_id TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id, c.discount_type, c.discount_value, c.applies_to_plan_id
  FROM coupons c
  WHERE c.code = p_code
    AND c.is_active = TRUE
    AND (c.valid_from IS NULL OR c.valid_from <= NOW())
    AND (c.valid_until IS NULL OR c.valid_until >= NOW())
    AND (c.max_redemptions IS NULL OR c.redemption_count < c.max_redemptions);
$$;

-- Como promover um usuário existente a admin (rodar manualmente no SQL Editor do
-- Supabase, trocando o e-mail):
--   UPDATE profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com');
