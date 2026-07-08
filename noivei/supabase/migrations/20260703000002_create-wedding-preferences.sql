-- Respostas do questionário de onboarding (Q1-Q24) usadas pelo motor de regras
-- do Checklist/Timeline — ver docs/checklist-rule-engine.md. Guardado como JSONB
-- porque as perguntas/flags ainda evoluem; o catálogo de tarefas é que dá o schema real.
CREATE TABLE wedding_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  UUID NOT NULL UNIQUE REFERENCES weddings(id) ON DELETE CASCADE,
  answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wedding_preferences_wedding_id ON wedding_preferences(wedding_id);

CREATE TRIGGER trg_wedding_preferences_updated_at
  BEFORE UPDATE ON wedding_preferences
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE wedding_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own wedding preferences"
  ON wedding_preferences FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_preferences.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own wedding preferences"
  ON wedding_preferences FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_preferences.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can update own wedding preferences"
  ON wedding_preferences FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_preferences.wedding_id AND w.user_id = auth.uid()
  ));
