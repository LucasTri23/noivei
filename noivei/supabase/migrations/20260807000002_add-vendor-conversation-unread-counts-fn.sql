-- Fornecedores — Fase 4: lista as conversas do usuário autenticado (casal OU
-- fornecedor) já com o nome da OUTRA ponta e a contagem de não lidas — usada por
-- GET /api/v1/vendor-conversations e pelos dois badges de não lida (sidebar do
-- casal, vendor-top-bar).
--
-- Por que SECURITY DEFINER: pra mostrar "conversando com Fulano" pro FORNECEDOR
-- (não só pro casal), a function precisa ler
-- weddings.couple_names de um casamento onde quem chama não é dono nem membro —
-- e a policy de SELECT de weddings (20260722000007) é
-- `auth.uid() = user_id OR fn_is_wedding_member(id, auth.uid())`, que um
-- fornecedor nunca satisfaz. Alargar a RLS de weddings pra resolver isso venceria
-- o propósito (um fornecedor participante de UMA conversa passaria a poder ler a
-- linha de weddings inteira via um client comum, não só o nome). Em vez disso,
-- esta function roda com privilégio elevado mas: (1) só devolve linhas onde
-- fn_can_access_conversation(vc.id, auth.uid()) é verdadeiro — MESMA fronteira de
-- autorização já usada pra ler as mensagens da conversa — e (2) só expõe
-- `couple_names`/`business_name`/`slug`, nunca a linha inteira de weddings/
-- vendor_profiles. `vendor_profiles.business_name`/`slug` já são públicos via
-- fn_vendor_is_publicly_visible (marketplace, Fase 3) então não há exposição nova
-- ali — a peça nova de verdade é `couple_names`.
-- Inclui também um preview da última mensagem (corpo + quem enviou) — pedido
-- explícito da tela de lista do casal ("last message preview"). Usa duas
-- sub-consultas LATERAL (não um JOIN + GROUP BY como a versão anterior desta
-- function): a última mensagem e a contagem de não lidas são duas perguntas
-- independentes sobre a mesma conversa, LATERAL deixa cada uma simples (um
-- ORDER BY + LIMIT 1 pra última mensagem não combina bem com agregação em GROUP
-- BY) sem precisar de uma CTE separada.
CREATE OR REPLACE FUNCTION fn_list_vendor_conversations()
RETURNS TABLE (
  id                           UUID,
  viewer_role                  TEXT,
  wedding_id                   UUID,
  wedding_couple_names         TEXT,
  vendor_id                    UUID,
  vendor_business_name         TEXT,
  vendor_slug                  TEXT,
  first_message_at             TIMESTAMPTZ,
  last_message_at              TIMESTAMPTZ,
  last_message_body            TEXT,
  last_message_sender_user_id  UUID,
  unread_count                 BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    vc.id,
    CASE WHEN fn_has_module_access(vc.wedding_id, auth.uid(), 'fornecedores') THEN 'couple' ELSE 'vendor' END,
    vc.wedding_id,
    w.couple_names,
    vc.vendor_id,
    vp.business_name,
    vp.slug,
    vc.first_message_at,
    vc.last_message_at,
    last_msg.body,
    last_msg.sender_user_id,
    COALESCE(unread.unread_count, 0)
  FROM vendor_conversations vc
  JOIN weddings w ON w.id = vc.wedding_id
  JOIN vendor_profiles vp ON vp.id = vc.vendor_id
  LEFT JOIN LATERAL (
    SELECT vm.body, vm.sender_user_id
    FROM vendor_messages vm
    WHERE vm.conversation_id = vc.id AND vm.deleted_at IS NULL
    ORDER BY vm.created_at DESC
    LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM vendor_messages vm
    WHERE vm.conversation_id = vc.id
      AND vm.sender_user_id <> auth.uid()
      AND vm.deleted_at IS NULL
      AND vm.created_at > COALESCE(
        (SELECT vcr.last_read_at FROM vendor_conversation_reads vcr
         WHERE vcr.conversation_id = vc.id AND vcr.user_id = auth.uid()),
        '-infinity'::timestamptz
      )
  ) unread ON true
  WHERE fn_can_access_conversation(vc.id, auth.uid())
  ORDER BY vc.last_message_at DESC NULLS LAST;
$$;

-- REVOKE/GRANT explícito — NÃO é o padrão das outras ~20 functions SECURITY
-- DEFINER deste projeto (nenhuma outra faz isso hoje), mas vale a pena aqui
-- especificamente: esta é a primeira SECURITY DEFINER deste projeto que lê de uma
-- tabela (weddings) cuja RLS o chamador normalmente NÃO passaria sozinho, então
-- travar quem pode sequer CHAMAR a function (só `authenticated`, nunca `anon`) é
-- uma camada barata a mais, mesmo que auth.uid() IS NULL já torne o resultado
-- vazio pra `anon` de qualquer forma (fn_can_access_conversation nunca casa com
-- p_user_id nulo).
REVOKE ALL ON FUNCTION fn_list_vendor_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_list_vendor_conversations() TO authenticated;
