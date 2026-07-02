-- Permite ao usuário criar/atualizar a própria assinatura (troca de plano simulada)
-- TODO Fase 2: remover/restringir quando o gateway de pagamento (Stripe/Pagar.me)
-- passar a gerenciar assinaturas server-side com service role
CREATE POLICY "users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
