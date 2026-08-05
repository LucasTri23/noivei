-- wedding_score_history — uma linha por casamento por dia com o Wedding Score
-- total e o valor individual dos 7 módulos, pra desenhar a evolução ao longo do
-- tempo (sparkline no Dashboard) — não só o total, também cada módulo em separado.
--
-- Uma linha por dia (UNIQUE wedding_id + recorded_date): recalculateWeddingScore
-- (src/lib/wedding-score/recalculate.ts) faz upsert nela a cada carregamento do
-- Dashboard via ON CONFLICT (wedding_id, recorded_date) DO UPDATE — não existe cron
-- novo, é a mesma rotina que já persiste weddings.wedding_score hoje.
CREATE TABLE wedding_score_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id     UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  score          INTEGER NOT NULL,
  checklist_pct  NUMERIC(5,2) NOT NULL,
  financeiro_pct NUMERIC(5,2) NOT NULL,
  convidados_pct NUMERIC(5,2) NOT NULL,
  rsvp_pct       NUMERIC(5,2) NOT NULL,
  mesas_pct      NUMERIC(5,2) NOT NULL,
  presentes_pct  NUMERIC(5,2) NOT NULL,
  arquivos_pct   NUMERIC(5,2) NOT NULL,
  recorded_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedding_id, recorded_date)
);

CREATE INDEX idx_wedding_score_history_wedding_id ON wedding_score_history(wedding_id, recorded_date);

ALTER TABLE wedding_score_history ENABLE ROW LEVEL SECURITY;

-- Só quem tem o módulo 'wedding_score' liberado (dono, ou membro com permissão
-- explícita/full_access — mesma fn_has_module_access usada no resto do app) lê o
-- próprio histórico. De propósito, SEM policy de INSERT/UPDATE pra
-- anon/authenticated: quem escreve é sempre o servidor (recalculateWeddingScore,
-- via service role, que ignora RLS) — mesmo padrão de outras tabelas calculadas
-- pelo servidor (ex: album_contributors/album_photos só têm SELECT pro cliente).
CREATE POLICY "wedding team can read wedding score history"
  ON wedding_score_history FOR SELECT
  USING (fn_has_module_access(wedding_id, auth.uid(), 'wedding_score'));
