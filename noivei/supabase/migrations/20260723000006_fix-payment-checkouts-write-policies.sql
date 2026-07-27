-- Bug real: a migration anterior (20260723000005) só criou policy de SELECT em
-- payment_checkouts, esquecendo INSERT/UPDATE — mas a rota de checkout
-- (POST /api/v1/billing/checkout) grava nessa tabela usando createSupabaseServer(),
-- o client autenticado normal (sujeito a RLS), não service role. Sem policy de
-- escrita, toda tentativa de checkout falhava com "new row violates row-level
-- security policy", exposto como "Erro ao iniciar o checkout." na tela.
CREATE POLICY "users can insert own payment checkouts"
  ON payment_checkouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own payment checkouts"
  ON payment_checkouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
