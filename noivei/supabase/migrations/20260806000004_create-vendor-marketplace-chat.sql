-- Fornecedores — Fase 1: schema de chat casal <-> fornecedor. SÓ schema nesta fase —
-- sem Realtime, sem UI (isso é Fase 4). `vendor_messages.sender_user_id` NUNCA deve
-- ser confiado a partir do input do client na rota de API (fase futura) — a RLS
-- abaixo já garante isso de forma independente (defesa em profundidade) mesmo que a
-- API esqueça de validar.
--
-- PRIMEIRA RLS DE DOIS LADOS deste projeto: toda tabela protegida por RLS existente
-- resolve acesso a partir de UM lado só, sempre enraizado em `weddings`
-- (fn_is_wedding_member / fn_has_module_access). Aqui o acesso precisa ser resolvido
-- a partir de QUALQUER UM dos dois lados — o casal (via módulo 'fornecedores' do
-- casamento) OU o fornecedor (dono da vendor_profiles da conversa). fn_can_access_
-- conversation() centraliza esse OR pra não duplicar a lógica em cada policy.

-- =========================================================
-- vendor_conversations
-- =========================================================
CREATE TABLE vendor_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id        UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_id         UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  first_message_at  TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedding_id, vendor_id)
);

CREATE INDEX idx_vendor_conversations_wedding_id ON vendor_conversations(wedding_id);
CREATE INDEX idx_vendor_conversations_vendor_id  ON vendor_conversations(vendor_id);

CREATE TRIGGER trg_vendor_conversations_updated_at
  BEFORE UPDATE ON vendor_conversations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- SECURITY DEFINER + SET search_path fixo, mesmo padrão de todo helper de RLS deste
-- projeto. Ler dentro da própria function evita qualquer recursão de policy nas
-- tabelas que ela protege (vendor_messages / vendor_conversation_reads).
CREATE OR REPLACE FUNCTION fn_can_access_conversation(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vendor_conversations vc
    WHERE vc.id = p_conversation_id
      AND (
        fn_has_module_access(vc.wedding_id, p_user_id, 'fornecedores')
        OR EXISTS (SELECT 1 FROM vendor_profiles vp WHERE vp.id = vc.vendor_id AND vp.user_id = p_user_id)
      )
  );
$$;

ALTER TABLE vendor_conversations ENABLE ROW LEVEL SECURITY;

-- Checagem direta (equivalente a fn_can_access_conversation, mas sem precisar de um
-- p_conversation_id — a linha JÁ é a conversa) pros dois lados.
CREATE POLICY "participants can read own conversation"
  ON vendor_conversations FOR SELECT
  USING (
    fn_has_module_access(wedding_id, auth.uid(), 'fornecedores')
    OR fn_owns_vendor(vendor_id, auth.uid())
  );

CREATE POLICY "admins can read all vendor conversations"
  ON vendor_conversations FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Só o lado do CASAL inicia uma conversa (navega o marketplace, clica em
-- "conversar") — o fornecedor nunca navega casamentos pra puxar assunto primeiro.
CREATE POLICY "wedding side can create conversation"
  ON vendor_conversations FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND fn_has_module_access(wedding_id, auth.uid(), 'fornecedores')
  );

-- Sem policy de UPDATE/DELETE pra authenticated: first_message_at/last_message_at
-- são mantidos pelo trigger abaixo (SECURITY DEFINER, não passa por RLS); não há
-- hard delete de conversa pelo client.

-- =========================================================
-- vendor_messages
-- =========================================================
CREATE TABLE vendor_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES vendor_conversations(id) ON DELETE CASCADE,
  sender_user_id  UUID NOT NULL REFERENCES auth.users(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_vendor_messages_conversation_id ON vendor_messages(conversation_id);
CREATE INDEX idx_vendor_messages_created_at      ON vendor_messages(created_at);

ALTER TABLE vendor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can read conversation messages"
  ON vendor_messages FOR SELECT
  USING (fn_can_access_conversation(conversation_id, auth.uid()));

CREATE POLICY "admins can read all vendor messages"
  ON vendor_messages FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Defesa em profundidade: mesmo que a rota de API (fase futura) esqueça de validar,
-- RLS sozinha já impede sender_user_id forjado (só é possível inserir se o VALOR
-- gravado bater com auth.uid() de quem está autenticado).
CREATE POLICY "participants can send message in own conversation"
  ON vendor_messages FOR INSERT
  WITH CHECK (
    fn_can_access_conversation(conversation_id, auth.uid())
    AND sender_user_id = auth.uid()
  );

-- Soft delete da própria mensagem (deleted_at) — mesma filosofia de "RLS de linha,
-- não de coluna" já documentada em vendor_profiles: tecnicamente esta policy libera
-- update de QUALQUER coluna da própria mensagem, não só deleted_at; a restrição de
-- só mexer em deleted_at é contrato da API (fase futura), não da RLS.
CREATE POLICY "sender can soft-delete own message"
  ON vendor_messages FOR UPDATE
  USING (sender_user_id = auth.uid())
  WITH CHECK (sender_user_id = auth.uid());

-- Trigger: mantém first_message_at/last_message_at sincronizados a cada mensagem
-- nova, sem depender da API (fase futura) lembrar de fazer isso em dois lugares.
-- SECURITY DEFINER necessário: sem isso, o UPDATE em vendor_conversations dentro do
-- trigger rodaria com o privilégio de quem inseriu a mensagem (authenticated), que
-- não tem NENHUMA policy de UPDATE em vendor_conversations — a escrita seria
-- silenciosamente bloqueada pela RLS.
CREATE OR REPLACE FUNCTION fn_touch_vendor_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vendor_conversations
    SET last_message_at  = NEW.created_at,
        first_message_at = COALESCE(first_message_at, NEW.created_at)
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_messages_touch_conversation
  AFTER INSERT ON vendor_messages
  FOR EACH ROW EXECUTE FUNCTION fn_touch_vendor_conversation_on_message();

-- =========================================================
-- vendor_conversation_reads — ponteiro de "último lido" POR PARTICIPANTE, não uma
-- coluna read_at em cada mensagem — evita ter que fazer update em massa de
-- milhares de linhas de mensagem só pra marcar uma conversa como lida.
-- =========================================================
CREATE TABLE vendor_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES vendor_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE vendor_conversation_reads ENABLE ROW LEVEL SECURITY;

-- Só o próprio ponteiro de leitura (não o do outro lado da conversa — indicador de
-- "visto" pro outro participante, se algum dia existir, é decisão de UI de fase
-- futura, não algo que a RLS precise liberar hoje).
CREATE POLICY "user can read own read pointer"
  ON vendor_conversation_reads FOR SELECT
  USING (user_id = auth.uid() AND fn_can_access_conversation(conversation_id, auth.uid()));

CREATE POLICY "user can upsert own read pointer (insert)"
  ON vendor_conversation_reads FOR INSERT
  WITH CHECK (user_id = auth.uid() AND fn_can_access_conversation(conversation_id, auth.uid()));

CREATE POLICY "user can upsert own read pointer (update)"
  ON vendor_conversation_reads FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND fn_can_access_conversation(conversation_id, auth.uid()));
