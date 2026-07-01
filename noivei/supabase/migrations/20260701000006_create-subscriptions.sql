-- Assinaturas
CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL REFERENCES plans(id),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('trialing','active','past_due','canceled','incomplete')),
  is_trial             BOOLEAN NOT NULL DEFAULT FALSE,
  trial_started_at     TIMESTAMPTZ,
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  gateway              TEXT CHECK (gateway IN ('stripe','pagarme')),
  gateway_sub_id       TEXT,
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
