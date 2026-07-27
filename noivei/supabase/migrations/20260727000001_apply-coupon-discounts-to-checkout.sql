-- Cupons percent/fixed já eram validados e "resgatados" (fn_redeem_coupon) desde
-- 20260723000002, mas o desconto nunca chegava a reduzir o valor cobrado de verdade
-- no Mercado Pago — o checkout sempre usava plans.price_brl cru. Este arquivo fecha
-- esse ciclo: guarda que o resgate ainda não foi "gasto" num pagamento
-- (coupon_redemptions.applied_at), deixa o checkout consultar isso pra calcular o
-- valor com desconto, e o webhook marcar como aplicado só quando o pagamento for
-- de fato aprovado (se o checkout for abandonado, o cupom continua disponível).

ALTER TABLE coupon_redemptions
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

ALTER TABLE payment_checkouts
  ADD COLUMN IF NOT EXISTS coupon_redemption_id UUID REFERENCES coupon_redemptions(id),
  ADD COLUMN IF NOT EXISTS discount_brl INTEGER NOT NULL DEFAULT 0;

-- `coupons` só é legível por admin (fn_is_admin) — um usuário comum não pode fazer
-- join direto de coupon_redemptions com coupons pra ver seu próprio desconto
-- pendente. Function SECURITY DEFINER expõe só o necessário (tipo/valor do
-- desconto ainda não aplicado, se houver algum válido pro plano escolhido).
DROP FUNCTION IF EXISTS fn_get_pending_coupon_discount(UUID, TEXT);
CREATE OR REPLACE FUNCTION fn_get_pending_coupon_discount(p_user_id UUID, p_plan_id TEXT)
RETURNS TABLE (
  redemption_id  UUID,
  discount_type  TEXT,
  discount_value INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT cr.id, c.discount_type, c.discount_value
  FROM coupon_redemptions cr
  JOIN coupons c ON c.id = cr.coupon_id
  WHERE cr.user_id = p_user_id
    AND cr.applied_at IS NULL
    AND c.discount_type IN ('percent', 'fixed')
    AND (c.applies_to_plan_id IS NULL OR c.applies_to_plan_id = p_plan_id)
  ORDER BY cr.redeemed_at DESC
  LIMIT 1;
$$;
