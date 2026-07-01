-- Planos disponíveis
CREATE TABLE plans (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  price_brl   INTEGER NOT NULL DEFAULT 0, -- em centavos
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limites por plano e feature
CREATE TABLE plan_limits (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature  TEXT NOT NULL,
  value    INTEGER NOT NULL,
  UNIQUE (plan_id, feature)
);

-- RLS: qualquer usuário autenticado pode ler planos
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read active plans"
  ON plans FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "anyone can read plan limits"
  ON plan_limits FOR SELECT
  USING (TRUE);

-- Seed: planos iniciais
INSERT INTO plans (id, name, description, price_brl) VALUES
  ('free',                 'Gratuito',  'Para começar o planejamento',           0),
  ('premium_monthly',      'Premium',   'Acesso completo, renovação mensal',  2990),
  ('premium_once',         'Premium',   'Acesso completo, pagamento único',   9990),
  ('premium_plus_monthly', 'Exclusivo', 'Tudo do Premium + IA, mensal',       4990),
  ('premium_plus_once',    'Exclusivo', 'Tudo do Premium + IA, único',       14990);

-- Seed: limites por plano
INSERT INTO plan_limits (plan_id, feature, value) VALUES
  -- Gratuito
  ('free', 'max_guests',    100),
  ('free', 'max_vendors',   10),
  ('free', 'max_checklists', 1),
  -- Premium
  ('premium_monthly', 'max_guests',    500),
  ('premium_monthly', 'max_vendors',   999),
  ('premium_monthly', 'max_checklists', 999),
  ('premium_once',    'max_guests',    500),
  ('premium_once',    'max_vendors',   999),
  ('premium_once',    'max_checklists', 999),
  -- Exclusivo
  ('premium_plus_monthly', 'max_guests',    999),
  ('premium_plus_monthly', 'max_vendors',   999),
  ('premium_plus_monthly', 'max_checklists', 999),
  ('premium_plus_once',    'max_guests',    999),
  ('premium_plus_once',    'max_vendors',   999),
  ('premium_plus_once',    'max_checklists', 999);
