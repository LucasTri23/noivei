-- Torna o catálogo de planos editável de ponta a ponta pelo admin: hoje dá pra editar
-- um plano já existente, mas quais planos existem/como se agrupam ainda era fixo no
-- código (constants/plans.ts + cartões hardcoded em plan-selector.tsx). Um plano
-- criado direto no banco não aparecia em lugar nenhum da UI.
--
-- group_key é o mecanismo central: planos com o MESMO group_key viram variantes de
-- cobrança do mesmo card (com um toggle, generalizando o "mensal vs. único" de hoje
-- pra qualquer número de variantes); group_key nulo = card próprio, sozinho.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS group_key     TEXT,
  ADD COLUMN IF NOT EXISTS billing_label TEXT,
  ADD COLUMN IF NOT EXISTS billing_note  TEXT,
  ADD COLUMN IF NOT EXISTS emoji         TEXT NOT NULL DEFAULT '💳',
  ADD COLUMN IF NOT EXISTS highlight     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order    INTEGER NOT NULL DEFAULT 0;

-- group_key já existia como NOT NULL num schema anterior a este arquivo — o Gratuito
-- precisa ficar NULL aqui (card sozinho, sem variantes), então a restrição precisa cair.
ALTER TABLE plans ALTER COLUMN group_key DROP NOT NULL;

-- Migra os 5 planos existentes pro novo modelo — mesmo agrupamento visual que já
-- existia (Premium mensal/único e Plus mensal/único cada um em seu card com toggle,
-- Gratuito sozinho), só que agora expresso em dado, não em código.
UPDATE plans SET group_key = NULL, emoji = '🆓', sort_order = 0 WHERE id = 'free';

UPDATE plans SET
  group_key = 'premium', sort_order = 1, highlight = TRUE, emoji = '💎',
  billing_label = CASE WHEN id = 'premium_monthly' THEN 'Mensal' ELSE 'Pagamento único' END,
  billing_note  = CASE WHEN id = 'premium_monthly' THEN '/mês' ELSE 'válido até 1 ano após o casamento' END
WHERE id IN ('premium_monthly', 'premium_once');

UPDATE plans SET
  group_key = 'plus', sort_order = 2, emoji = '👑',
  billing_label = CASE WHEN id = 'premium_plus_monthly' THEN 'Mensal' ELSE 'Pagamento único' END,
  billing_note  = CASE WHEN id = 'premium_plus_monthly' THEN '/mês' ELSE 'válido por um período após o casamento' END
WHERE id IN ('premium_plus_monthly', 'premium_plus_once');

-- plan_feature_values.group_key tinha CHECK IN ('free','premium','plus') — travava a
-- tabela de comparação aos mesmos 3 grupos fixos. Sem o CHECK, a tela de comparação
-- passa a ter uma coluna por group_key distinto que existir entre os planos ativos
-- (calculado em app, não fixo no banco).
ALTER TABLE plan_feature_values DROP CONSTRAINT IF EXISTS plan_feature_values_group_key_check;

-- Os valores já seedados usavam 'free'/'premium'/'plus' como group_key — segue valendo
-- porque são exatamente os group_key que os planos correspondentes têm agora (exceto
-- 'free', que ficou NULL em `plans` por não ter variantes; a comparação usa o próprio
-- id como chave de grupo quando group_key é nulo, então nenhum dado precisa mudar
-- aqui — só a leitura em app resolve isso).
