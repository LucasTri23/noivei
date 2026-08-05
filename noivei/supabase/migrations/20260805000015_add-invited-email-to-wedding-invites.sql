-- SEC-003 (auditoria de segurança): hoje um convite (wedding_invites) não é vinculado
-- a nenhum e-mail — qualquer conta autenticada que tenha o link consegue aceitar e
-- ganhar o nível de acesso associado (ver src/app/api/v1/invites/[token]/accept/route.ts).
-- Isso é um problema se o link vazar (encaminhado por engano, printado em captura de
-- tela, etc.): qualquer pessoa com o link vira membro do casamento.
--
-- Esta migration adiciona uma coluna opcional pra travar o convite num e-mail
-- específico. A checagem em si (comparar o e-mail da conta autenticada contra esta
-- coluna no momento do aceite) é feita em código, não em RLS — o mesmo padrão já usado
-- pro resto do fluxo de convite (ver comentário original em
-- 20260703000011_create-wedding-members-and-invites.sql: "leitura do convite pelo token
-- e o aceite acontecem via client service role na API").
--
-- invited_email fica NULLABLE DE PROPÓSITO — não é um descuido, é uma decisão
-- consciente de compatibilidade retroativa:
--   - Convites já existentes (criados antes desta migration) têm invited_email = NULL.
--     Para esses, o comportamento de aceite continua EXATAMENTE como hoje: qualquer
--     conta autenticada com o link pode aceitar. Backfillar um e-mail nesses convites
--     não seria possível de forma correta (nunca foi coletado quem era o destinatário
--     pretendido) e forçar invited_email NOT NULL quebraria na hora todo convite
--     pendente já enviado e ainda não aceito (ex.: link copiado e mandado por WhatsApp
--     ontem) — o dono teria que gerar e reenviar um novo link pra cada convite em
--     aberto no exato momento do deploy desta migration.
--   - Convites CRIADOS a partir de agora podem opcionalmente receber um e-mail (campo
--     novo, opcional, no formulário de criar convite — ver
--     src/components/perfil/wedding-members-manager.tsx). Quando invited_email está
--     preenchido, o aceite passa a exigir que bata com o e-mail da conta autenticada
--     (normalizado do mesmo jeito: trim + lowercase, mesmo padrão de
--     src/app/api/v1/auth/login/route.ts) — ver a checagem em accept/route.ts,
--     erro EMAIL_MISMATCH (403).
ALTER TABLE wedding_invites ADD COLUMN invited_email TEXT;

COMMENT ON COLUMN wedding_invites.invited_email IS
  'E-mail (normalizado: trim + lowercase) ao qual o convite fica restrito. NULL = qualquer conta autenticada pode aceitar — comportamento legado/opcional, mantido de propósito (ver comentário desta migration), não uma lacuna a ser corrigida depois.';
