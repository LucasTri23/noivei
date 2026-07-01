-- Casamentos
CREATE TABLE weddings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_names         TEXT NOT NULL,
  wedding_date         DATE,
  venue                TEXT,
  city                 TEXT,
  guest_limit          INTEGER NOT NULL DEFAULT 100,
  budget               INTEGER, -- em centavos
  style                TEXT CHECK (style IN ('rustico','classico','moderno','boho','minimalista','romantico','outro')),
  wedding_color        TEXT NOT NULL DEFAULT '#C39A3E',
  wedding_score        INTEGER NOT NULL DEFAULT 0,
  score_calculated_at  TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weddings_user_id ON weddings(user_id);
CREATE INDEX idx_weddings_active  ON weddings(user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_weddings_updated_at
  BEFORE UPDATE ON weddings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- RLS
ALTER TABLE weddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own weddings"
  ON weddings FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "users can insert own weddings"
  ON weddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own weddings"
  ON weddings FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Soft delete apenas (nunca DELETE direto — LGPD 30 dias)
CREATE POLICY "users can soft-delete own weddings"
  ON weddings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
