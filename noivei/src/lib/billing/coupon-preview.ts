export interface CouponRedeemResult {
  discount_type:      string
  discount_value:     number | null
  applies_to_plan_id: string | null
}

export interface CouponPreviewLine {
  planId:      string
  planLabel:   string
  priceBefore: number // centavos
  priceAfter:  number // centavos
}

/**
 * Calcula o preço com desconto de cada plano pago afetado por um cupom percent/fixed
 * recém-resgatado — free_days não tem preview de preço (o acesso já foi concedido na
 * hora, dentro da própria fn_redeem_coupon). applies_to_plan_id nulo = desconto vale
 * pra qualquer plano pago, não só um.
 */
export function computeCouponPreview(
  plans:  { id: string; name: string; billing_label: string | null; price_brl: number }[],
  result: CouponRedeemResult,
): CouponPreviewLine[] {
  if (result.discount_type === 'free_days' || result.discount_value == null) return []

  const affected = result.applies_to_plan_id
    ? plans.filter((p) => p.id === result.applies_to_plan_id)
    : plans.filter((p) => p.price_brl > 0)

  return affected.map((plan) => ({
    planId:      plan.id,
    planLabel:   plan.billing_label ? `${plan.name} — ${plan.billing_label}` : plan.name,
    priceBefore: plan.price_brl,
    priceAfter:  result.discount_type === 'percent'
      ? Math.round(plan.price_brl * (1 - result.discount_value! / 100))
      : Math.max(0, plan.price_brl - result.discount_value!),
  }))
}
