-- wedding_score_module_weights — peso de cada um dos 7 módulos que compõem o
-- Wedding Score completo (roadmap item 2), editável em /admin/wedding-score.
--
-- A soma dos pesos NÃO precisa ser exatamente 100: `calculateWeddingScore`
-- (src/lib/wedding-score/calculator.ts) normaliza cada peso pela SOMA REAL dos
-- pesos configurados no momento do cálculo, então mesmo que o admin salve pesos
-- que somem 137 ou 60, o resultado final continua sendo 0-100 corretamente — só
-- muda a PROPORÇÃO relativa entre os módulos. Peso 0 é válido e intencional:
-- zera a contribuição daquele módulo sem precisar removê-lo.
CREATE TABLE wedding_score_module_weights (
  module_key TEXT PRIMARY KEY CHECK (module_key IN (
    'checklist', 'financeiro', 'convidados', 'rsvp', 'mesas', 'presentes', 'arquivos'
  )),
  label      TEXT NOT NULL,
  weight     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed com os pesos definidos no roadmap (soma 100 hoje, mas ver comentário acima —
-- não é uma invariante imposta pelo schema). sort_order reflete a ordem de exibição
-- dos 7 cartõezinhos de módulo no Dashboard.
INSERT INTO wedding_score_module_weights (module_key, label, weight, sort_order) VALUES
  ('checklist',  'Checklist',          25, 0),
  ('financeiro', 'Financeiro',         20, 1),
  ('convidados', 'Convidados',         15, 2),
  ('rsvp',       'RSVP',               10, 3),
  ('mesas',      'Mesas',              10, 4),
  ('presentes',  'Lista de presentes', 10, 5),
  ('arquivos',   'Central de arquivos',10, 6)
ON CONFLICT (module_key) DO NOTHING;

CREATE TRIGGER trg_wedding_score_module_weights_updated_at
  BEFORE UPDATE ON wedding_score_module_weights
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE wedding_score_module_weights ENABLE ROW LEVEL SECURITY;

-- Não é informação sensível — leitura aberta, mesmo padrão de plan_limits/app_settings.
-- Escrita só admin.
CREATE POLICY "anyone can read wedding score module weights" ON wedding_score_module_weights FOR SELECT USING (TRUE);
CREATE POLICY "admins can update wedding score module weights" ON wedding_score_module_weights FOR UPDATE
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));
