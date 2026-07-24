-- Rate limiting genérico via Postgres: uma tabela de "hits" + uma function que
-- conta quantos aconteceram numa janela de tempo pra uma chave qualquer
-- (bucket_key). Usada tanto por IP quanto por alvo (e-mail/token/usuário) nos
-- endpoints públicos e na pré-checagem de signup/login/esqueci-senha.

CREATE TABLE rate_limit_hits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_hits_bucket_created ON rate_limit_hits(bucket_key, created_at);

-- Sem policy pra authenticated/anon: todo acesso passa pela function abaixo
-- (SECURITY DEFINER), nunca client direto.
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fn_check_rate_limit(p_key TEXT, p_max_hits INTEGER, p_window_seconds INTEGER)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ := NOW() - make_interval(secs => p_window_seconds);
  v_count INTEGER;
BEGIN
  DELETE FROM rate_limit_hits WHERE bucket_key = p_key AND created_at < v_window_start;

  SELECT COUNT(*) INTO v_count FROM rate_limit_hits WHERE bucket_key = p_key AND created_at >= v_window_start;

  IF v_count >= p_max_hits THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  INSERT INTO rate_limit_hits (bucket_key) VALUES (p_key);

  -- Limpeza oportunista global (1% das chamadas) — evita a tabela crescer pra
  -- sempre com buckets que nunca mais são checados de novo, sem precisar de um
  -- cron novo só pra isso.
  IF random() < 0.01 THEN
    DELETE FROM rate_limit_hits WHERE created_at < NOW() - INTERVAL '1 day';
  END IF;

  RETURN QUERY SELECT TRUE, p_max_hits - v_count - 1;
END;
$$;
