-- wedding_score_config — configuração global do Wedding Score completo (roadmap
-- item 2), singleton editável em /admin/wedding-score. Mesmo padrão de "linha
-- única" de app_settings (migration 20260727000002): id fixo em TRUE com CHECK,
-- então só pode existir 1 linha.
--
-- `enabled` é um kill switch GLOBAL: quando false, o card inteiro (inclusive o
-- teaser bloqueado de quem não tem o módulo no plano) some do Dashboard pra
-- TODO MUNDO — independente de plano/módulo por casamento (ver dashboard/page.tsx).
--
-- label_low/description_low, label_mid/description_mid, label_high/description_high
-- são os 3 níveis motivacionais que hoje vivem hardcoded na function
-- `weddingScoreMeta` do Dashboard (score < 40 / 40-70 / 70+) — viram colunas
-- editáveis pelo admin. Os LIMIARES (40/70) continuam fixos em código de propósito
-- (não fazem parte deste roadmap item); só o texto exibido vem do banco agora.
CREATE TABLE wedding_score_config (
  id                BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled           BOOLEAN NOT NULL DEFAULT true,
  title             TEXT NOT NULL DEFAULT 'Wedding Score',
  description       TEXT NOT NULL DEFAULT 'Descubra o quanto o planejamento do casamento já está avançado.',
  label_low         TEXT NOT NULL DEFAULT 'Início de jornada',
  description_low   TEXT NOT NULL DEFAULT 'Ainda no começo — cada passo conta.',
  label_mid         TEXT NOT NULL DEFAULT 'No caminho',
  description_mid   TEXT NOT NULL DEFAULT 'Vocês estão avançando bem, continue assim.',
  label_high        TEXT NOT NULL DEFAULT 'Quase lá',
  description_high  TEXT NOT NULL DEFAULT 'Seu planejamento está bem encaminhado.',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed com os valores EXATOS já hardcoded hoje em weddingScoreMeta() (dashboard/page.tsx)
-- e no teaser bloqueado — pra não mudar nada visualmente até o admin editar de propósito.
INSERT INTO wedding_score_config (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_wedding_score_config_updated_at
  BEFORE UPDATE ON wedding_score_config
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE wedding_score_config ENABLE ROW LEVEL SECURITY;

-- Não é informação sensível — leitura aberta, mesmo padrão de app_settings/plan_limits.
-- Escrita só admin.
CREATE POLICY "anyone can read wedding score config" ON wedding_score_config FOR SELECT USING (TRUE);
CREATE POLICY "admins can update wedding score config" ON wedding_score_config FOR UPDATE
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));
