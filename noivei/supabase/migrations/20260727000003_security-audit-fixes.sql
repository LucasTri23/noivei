-- Correções da auditoria de segurança de 2026-07-27 (achados SEC-01 e SEC-11).

-- ── SEC-01 (crítica): subscriptions permitia auto-concessão de QUALQUER plano ──
-- As policies de INSERT/UPDATE criadas em 20260702000004 só checavam
-- `auth.uid() = user_id`, sem restringir plan_id/status — a Fase 2 (Mercado Pago)
-- já existe (ativação de plano pago passa pelo webhook/service role ou por
-- fn_redeem_coupon, SECURITY DEFINER), mas a policy antiga nunca foi revogada.
-- Qualquer usuário autenticado podia, direto do console do navegador, fazer
-- `supabase.from('subscriptions').insert({ user_id: <próprio id>, plan_id: 'premium_plus_monthly', status: 'active' })`
-- e ganhar qualquer plano pago de graça, pra sempre — fn_resolve_wedding_plan não
-- distinguia uma linha gravada assim de uma ativada de verdade pelo webhook.
--
-- Restringe a escrita direta do client a só o plano gratuito (price_brl = 0 em
-- `plans`, não um id fixo — cobre qualquer plano $0 que o admin venha a criar,
-- sem precisar de outra migration). Ativação de plano pago continua exclusiva ao
-- webhook do Mercado Pago (service role, bypassa RLS) e a fn_redeem_coupon
-- (SECURITY DEFINER) — nenhum dos dois é afetado por esta mudança.
DROP POLICY IF EXISTS "users can insert own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "users can update own subscriptions" ON subscriptions;

CREATE POLICY "users can create own free subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'active'
    AND EXISTS (SELECT 1 FROM plans p WHERE p.id = subscriptions.plan_id AND p.price_brl = 0)
  );

CREATE POLICY "users can downgrade own subscription to free"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'active'
    AND EXISTS (SELECT 1 FROM plans p WHERE p.id = subscriptions.plan_id AND p.price_brl = 0)
  );

-- ── SEC-11 (baixa): fn_on_user_created sem SET search_path ──
-- Única function SECURITY DEFINER do projeto sem essa proteção (CWE-427). As
-- escritas já são schema-qualificadas (public.profiles/public.subscriptions), então
-- o risco prático hoje é baixo — mas uma edição futura sem qualificação explícita
-- herdaria a exposição silenciosamente. CREATE OR REPLACE preserva o trigger
-- existente (trg_users_on_insert), que referencia a function pelo nome.
CREATE OR REPLACE FUNCTION fn_on_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$;
