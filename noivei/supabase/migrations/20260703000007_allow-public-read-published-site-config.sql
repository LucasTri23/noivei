-- O site público (/[slug]) hoje é lido via service role (ver src/lib/site/get-public-site-by-slug.ts),
-- que já ignora RLS. Mesmo assim, adicionamos a policy correta para manter a tabela coerente
-- caso o client público troque de service role para anon key no futuro.

CREATE POLICY "anyone can read published site config"
  ON site_config FOR SELECT
  USING (published = TRUE);
