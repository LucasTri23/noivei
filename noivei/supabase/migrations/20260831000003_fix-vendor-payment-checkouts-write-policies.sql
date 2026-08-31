-- Fornecedores — Fase 5 (billing completo): mesmo bug real já corrigido do lado do
-- casal em 20260723000006 — vendor_payment_checkouts (20260806000003) só ganhou
-- policy de SELECT. A rota de checkout do fornecedor (fase futura até aqui) precisa
-- gravar com o client autenticado normal (createSupabaseServer(), sujeito a RLS, não
-- service role) — sem policy de escrita, toda tentativa de checkout falharia com
-- "new row violates row-level security policy".
CREATE POLICY "vendor can insert own payment checkouts"
  ON vendor_payment_checkouts FOR INSERT
  WITH CHECK (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "vendor can update own payment checkouts"
  ON vendor_payment_checkouts FOR UPDATE
  USING (fn_owns_vendor(vendor_id, auth.uid()))
  WITH CHECK (fn_owns_vendor(vendor_id, auth.uid()));
