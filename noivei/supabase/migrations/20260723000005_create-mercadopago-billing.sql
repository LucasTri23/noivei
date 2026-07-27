-- Mercado Pago — Fase 1: cobrança de assinaturas (Wednest ↔ casal). Fase 2 (presente
-- de convidado direto na conta do casal, via split/marketplace, exige cada casal
-- conectar a própria conta) fica pra depois.

-- billing_interval decide qual API do Mercado Pago criar no checkout: 'once' vira uma
-- Preferência (Checkout Pro, pagamento avulso); 'monthly' vira um Preapproval
-- (assinatura recorrente). billing_label já indicava isso em texto livre pra exibição
-- — isso aqui é a versão estruturada que o código de cobrança realmente usa.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'once'
    CHECK (billing_interval IN ('once', 'monthly'));

UPDATE plans SET billing_interval = 'monthly' WHERE id LIKE '%\_monthly' ESCAPE '\';
UPDATE plans SET billing_interval = 'once'    WHERE id LIKE '%\_once' ESCAPE '\' OR id = 'free';

-- gateway já existia como CHECK ('stripe','pagarme') — nunca foi usado de verdade
-- (billing sempre foi manual/simulado até agora). Recria o CHECK incluindo
-- 'mercadopago', sem tocar em mais nada da tabela/coluna.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_gateway_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_gateway_check CHECK (gateway IN ('stripe', 'pagarme', 'mercadopago'));

-- =========================================================
-- payment_checkouts — uma tentativa de checkout (preference ou preapproval)
-- =========================================================
-- mp_reference é gerado por NÓS (não pelo Mercado Pago) e mandado como
-- external_reference na criação da preference/preapproval — é a ÚNICA forma segura
-- de o webhook (que roda sem sessão de usuário nenhuma) saber a qual user/plano um
-- pagamento pertence, sem confiar em nada que o client tenha alegado depois do fato.
CREATE TABLE payment_checkouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id           TEXT NOT NULL REFERENCES plans(id),
  mp_reference      TEXT NOT NULL UNIQUE,
  mp_preference_id  TEXT,
  mp_preapproval_id TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_checkouts_user_id      ON payment_checkouts(user_id);
CREATE INDEX idx_payment_checkouts_mp_reference ON payment_checkouts(mp_reference);

CREATE TRIGGER trg_payment_checkouts_updated_at
  BEFORE UPDATE ON payment_checkouts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE payment_checkouts ENABLE ROW LEVEL SECURITY;

-- Leitura só da própria tentativa (a tela "processando pagamento" poder checar
-- status). Sem policy de INSERT/UPDATE pra authenticated/anon: toda escrita passa
-- pela API (checkout usa createSupabaseServer() com requireAuth; o webhook usa
-- service role) — o client nunca grava aqui direto.
CREATE POLICY "users can read own payment checkouts"
  ON payment_checkouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins can read all payment checkouts"
  ON payment_checkouts FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- =========================================================
-- mp_webhook_events — idempotência: o Mercado Pago pode reenviar a mesma
-- notificação mais de uma vez; sem isso, processaríamos o mesmo pagamento (e a
-- ativação do plano) repetidas vezes.
-- =========================================================
CREATE TABLE mp_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_key TEXT NOT NULL UNIQUE,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sem policy nenhuma pra authenticated/anon: só o service role (usado pela rota de
-- webhook, que não tem sessão de usuário) escreve/lê aqui.
ALTER TABLE mp_webhook_events ENABLE ROW LEVEL SECURITY;
