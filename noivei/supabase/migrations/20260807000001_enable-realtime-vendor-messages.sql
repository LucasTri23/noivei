-- Fornecedores — Fase 4: liga Realtime (postgres_changes) em vendor_messages.
-- PRIMEIRO USO DE REALTIME deste projeto — todo outro recurso "ao vivo" existente
-- (mural de fotos, ver src/components/album/live-photo-gallery.tsx) usa polling de
-- propósito, então nenhuma tabela deste banco jamais foi adicionada à publication
-- `supabase_realtime` antes desta migration.
--
-- Isso é OBRIGATÓRIO e é fácil de esquecer: uma tabela só emite eventos
-- postgres_changes se estiver na publication `supabase_realtime` — sem isso, a
-- verificação de segurança abaixo seria irrelevante, porque nenhum evento chegaria
-- nunca, mas também nenhum indício de erro apareceria (o client só ficaria
-- "conectado" e nunca receberia nada, silenciosamente).
--
-- ── Sobre RLS + Realtime nesta versão (@supabase/realtime-js 2.110.0, mesma major
-- do @supabase/supabase-js instalado) ──────────────────────────────────────────
-- Não é preciso configurar NADA além disso (nenhuma "Realtime Authorization"/
-- private channel/policy em realtime.messages) porque `postgres_changes` — ao
-- contrário de Broadcast/Presence — sempre foi autorizado via RLS da própria
-- tabela, avaliada pelo servidor Realtime usando o JWT autenticado da conexão
-- (não o service role). A doc do client instalado confirma isso literalmente:
-- `RealtimeClient.setAuth()` (src/RealtimeClient.ts) documenta o parâmetro como
-- "the JWT access token used for channel subscription authorization AND REALTIME
-- RLS". `SupabaseClient` (src/SupabaseClient.ts, _handleTokenChanged) já chama
-- `this.realtime.setAuth(token)` automaticamente a cada SIGNED_IN/TOKEN_REFRESHED
-- — ou seja, `createSupabaseBrowser()` (src/lib/supabase/browser.ts, usa
-- `@supabase/ssr` → `createClient` por baixo) já propaga o JWT do usuário
-- logado pro socket do Realtime sem nenhum código extra no client de chat.
--
-- Resultado prático: a policy "participants can read conversation messages" (USING
-- fn_can_access_conversation(conversation_id, auth.uid()), migration
-- 20260806000004) É a autorização do Realtime também — um usuário que não é
-- participante de uma conversa nunca recebe o evento INSERT dela, mesmo sabendo o
-- conversation_id, pelo mesmo motivo que um SELECT dele nessa linha já retorna
-- vazio hoje. Ver src/tests/rls/vendor-conversations-realtime.test.ts para o teste
-- que exercita isso com duas sessões autenticadas de verdade.
--
-- REPLICA IDENTITY padrão (não FULL) é suficiente: só escutamos INSERT
-- (mensagem nova), que sempre carrega a linha inteira em NEW independente da
-- replica identity — FULL só passaria a importar se algum dia escutássemos
-- UPDATE/DELETE e precisássemos do OLD completo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vendor_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendor_messages;
  END IF;
END $$;
