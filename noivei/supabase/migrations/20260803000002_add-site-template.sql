-- Segundo estilo visual selecionável para o site público do casal ("portfolio",
-- linguagem visual ousada/masonry — mesma direção do mural de fotos criado na
-- migration anterior), disponível apenas para quem tem o módulo 'album'
-- liberado no plano (mesmo critério de plan_module_access reaproveitado de
-- 20260803000001). O estilo atual (renderização inalterada de src/app/[slug])
-- vira o valor padrão 'classic'.
--
-- ADD COLUMN IF NOT EXISTS / checagem de constraint por nome antes de criar:
-- torna este arquivo seguro para rodar de novo caso uma execução anterior já
-- tenha aplicado parte dele.
ALTER TABLE site_config
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'classic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_config_template_check'
  ) THEN
    ALTER TABLE site_config
      ADD CONSTRAINT site_config_template_check CHECK (template IN ('classic', 'portfolio'));
  END IF;
END $$;

-- Sem mudança de RLS: as policies existentes de site_config (users can
-- read/insert/update/delete own site config, + "anyone can read published
-- site config") já cobrem a tabela inteira, `template` incluso. O fail-safe
-- de "template 'portfolio' só renderiza se o plano ATUAL ainda liberar o
-- módulo 'album'" é responsabilidade da camada de leitura pública
-- (src/lib/site/get-public-site-by-slug.ts), não do banco — o valor
-- armazenado pode ficar "stale" em 'portfolio' após um downgrade de plano,
-- de propósito, para não perder a preferência do casal caso o plano volte.
