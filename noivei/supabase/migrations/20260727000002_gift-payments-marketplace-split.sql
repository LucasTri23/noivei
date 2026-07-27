-- Mercado Pago — Fase 2: presente de convidado cai direto na conta do CASAL (não da
-- Wednest), via marketplace/split OAuth. A Wednest nunca custodia o dinheiro do
-- presente: cada pagamento já nasce dividido — a fatia da Wednest (marketplace_fee)
-- e o resto direto pro casal — usando o access_token OBTIDO do casal via OAuth, não
-- o token da própria Wednest (esse continua só para as assinaturas, ver
-- 20260723000005).

-- =========================================================
-- app_settings — configuração global de plataforma (singleton: 1 linha só)
-- =========================================================
-- Padrão de "linha única": id fixo em TRUE com CHECK, então só pode existir 1 linha —
-- não precisa de lógica de "pega a primeira" nem risco de duplicar configuração.
CREATE TABLE app_settings (
  id                     BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  platform_fee_percent   NUMERIC(4,2) NOT NULL DEFAULT 5 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 10),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Não é informação sensível (só a % de comissão da plataforma) — leitura aberta,
-- mesmo padrão de plan_limits/plan_feature_*. Escrita só admin.
CREATE POLICY "anyone can read app settings" ON app_settings FOR SELECT USING (TRUE);
CREATE POLICY "admins can update app settings" ON app_settings FOR UPDATE
  USING (fn_is_admin(auth.uid())) WITH CHECK (fn_is_admin(auth.uid()));

-- =========================================================
-- wedding_mp_accounts — tokens OAuth da conta Mercado Pago do CASAL (não da Wednest)
-- =========================================================
-- Sem NENHUMA policy de leitura/escrita pra authenticated/anon, de propósito: são
-- credenciais de acesso a dinheiro de terceiros. Toda leitura/escrita passa por rotas
-- de API que já conferem requireWeddingOwnership em código antes de tocar aqui via
-- service role — mesmo padrão de mp_webhook_events.
CREATE TABLE wedding_mp_accounts (
  wedding_id       UUID PRIMARY KEY REFERENCES weddings(id) ON DELETE CASCADE,
  mp_user_id       TEXT NOT NULL,
  mp_email         TEXT,
  mp_nickname      TEXT,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_wedding_mp_accounts_updated_at
  BEFORE UPDATE ON wedding_mp_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE wedding_mp_accounts ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- mp_oauth_states — anti-CSRF de curta duração para o fluxo "Conectar conta MP"
-- =========================================================
-- O MP devolve esse `state` sem alteração no callback — sem guardar de quem/pra qual
-- casamento era, um terceiro poderia iniciar o fluxo com o code de outra pessoa e
-- vincular a conta MP dela a um casamento que não é o dela. Vida curta (10 min,
-- checado em código) e uso único (deletado ao ser consumido no callback).
CREATE TABLE mp_oauth_states (
  state      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mp_oauth_states ENABLE ROW LEVEL SECURITY;
-- Sem policy nenhuma: só o service role (rota de connect grava, rota de callback lê e apaga).

-- =========================================================
-- gift_payment_checkouts — uma tentativa de pagamento de presente por um convidado
-- =========================================================
CREATE TABLE gift_payment_checkouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id             UUID NOT NULL REFERENCES gift_registry_items(id) ON DELETE CASCADE,
  wedding_id          UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_name          TEXT,
  amount_brl          INTEGER NOT NULL,           -- valor do presente, em centavos
  application_fee_brl INTEGER NOT NULL DEFAULT 0,  -- comissão da Wednest retida, em centavos
  mp_reference        TEXT NOT NULL UNIQUE,        -- external_reference gerado por nós
  mp_preference_id    TEXT,
  mp_payment_id       TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gift_payment_checkouts_wedding_id   ON gift_payment_checkouts(wedding_id);
CREATE INDEX idx_gift_payment_checkouts_mp_reference ON gift_payment_checkouts(mp_reference);

CREATE TRIGGER trg_gift_payment_checkouts_updated_at
  BEFORE UPDATE ON gift_payment_checkouts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE gift_payment_checkouts ENABLE ROW LEVEL SECURITY;

-- Casal pode ver o histórico de presentes pagos pelo app (transparência) — mesma
-- checagem de dono/membro usada em gift_registry_items. Sem policy de INSERT/UPDATE
-- pra client nenhum: o convidado que paga é anônimo (sem sessão), e a escrita
-- (criar checkout, confirmar via webhook) sempre passa por service role.
CREATE POLICY "wedding members can read own gift payment checkouts"
  ON gift_payment_checkouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = gift_payment_checkouts.wedding_id AND w.user_id = auth.uid()
  ));
