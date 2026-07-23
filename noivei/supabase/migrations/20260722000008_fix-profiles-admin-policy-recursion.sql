-- Bug real de produção: a policy "admins can read all profiles" (desde a primeira
-- migration de profiles, 20260701000003, bem antes do painel admin existir) fazia um
-- EXISTS (SELECT 1 FROM profiles ...) DIRETO na mesma tabela que ela protege. Toda
-- vez que o Postgres precisa avaliar essa policy pra decidir se uma linha de
-- `profiles` é visível, ele roda essa subquery — que por sua vez é, ela mesma, uma
-- leitura de `profiles`, reavaliando a MESMA policy de novo: "infinite recursion
-- detected in policy for relation profiles".
--
-- Ficava adormecido na maior parte do tempo porque o Postgres normalmente resolve
-- primeiro a condição "auth.uid() = id" (a policy "users can read own profile") e
-- nem chega a avaliar o EXISTS por curto-circuito do OR — mas a ordem de avaliação
-- não é garantida pelo plano de execução, e a leitura de profiles feita pelo painel
-- admin caiu exatamente no caminho que dispara a recursão.
--
-- fn_is_admin() (criada na migration do painel admin, 20260722000006) quebra o
-- ciclo: por ser SECURITY DEFINER, a subquery dela roda com o privilégio do dono da
-- function, sem reaplicar a RLS de profiles.
DROP POLICY "admins can read all profiles" ON profiles;
CREATE POLICY "admins can read all profiles"
  ON profiles FOR SELECT
  USING (fn_is_admin(auth.uid()));
