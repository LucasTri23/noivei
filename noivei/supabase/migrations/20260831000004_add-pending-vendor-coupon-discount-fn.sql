-- Fornecedores — Fase 5 (billing completo): espelha fn_get_pending_coupon_discount
-- (20260727000001) pro lado do fornecedor. vendor_coupons só é legível por admin
-- (fn_is_admin) — o fornecedor não pode fazer join direto de
-- vendor_coupon_redemptions com vendor_coupons pra ver o próprio desconto pendente;
-- esta function SECURITY DEFINER expõe só o necessário (tipo/valor do desconto
-- percent/fixed ainda não aplicado a nenhum pagamento, se houver um válido pro plano
-- escolhido). free_days nunca aparece aqui: fn_redeem_vendor_coupon já concede a
-- assinatura direto, sem passar pelo checkout — não tem "desconto pendente" a
-- aplicar num pagamento nesse caso.
CREATE OR REPLACE FUNCTION fn_get_pending_vendor_coupon_discount(p_vendor_id UUID, p_vendor_plan_id TEXT)
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
  FROM vendor_coupon_redemptions cr
  JOIN vendor_coupons c ON c.id = cr.coupon_id
  WHERE cr.vendor_id = p_vendor_id
    AND cr.applied_at IS NULL
    AND c.discount_type IN ('percent', 'fixed')
    AND (c.applies_to_plan_id IS NULL OR c.applies_to_plan_id = p_vendor_plan_id)
  ORDER BY cr.redeemed_at DESC
  LIMIT 1;
$$;
