-- Performance: resolveWeddingPlanId (src/lib/billing/check-limit.ts) resolvia o plano
-- do casamento com 2 round-trips sequenciais (busca weddings.user_id, depois busca
-- subscriptions por esse user_id). Essa função roda em praticamente toda página
-- autenticada (layout, dashboard, paywall-gate, checklist, financeiro...) — cada
-- round-trip a mais nessa cadeia é sentido em toda navegação do app. Uma única
-- function SQL resolve os dois passos no servidor do banco, virando 1 round-trip.
--
-- LANGUAGE sql + STABLE (não SECURITY DEFINER): roda com o privilégio de quem chama,
-- então a RLS de `subscriptions` (dono + "members can read their wedding owner's
-- subscription", ver 20260703000011) continua valendo — um usuário sem acesso ao
-- casamento simplesmente não enxerga a assinatura e a function retorna NULL.
CREATE OR REPLACE FUNCTION fn_resolve_wedding_plan(p_wedding_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.plan_id
  FROM weddings w
  JOIN subscriptions s
    ON s.user_id = w.user_id
    AND s.status = 'active'
  WHERE w.id = p_wedding_id
    AND w.deleted_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1
$$;
