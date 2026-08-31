-- Fornecedores — correção de segurança (auditoria de comparação Fase 1-9):
-- "vendor can update own profile" e "sender can soft-delete own message" são RLS de
-- LINHA, não de COLUNA — como já documentado nas migrations 20260806000002 e
-- 20260806000004, tecnicamente permitem ao dono atualizar QUALQUER campo da própria
-- linha, inclusive status/featured/rejection_reason (vendor_profiles) ou
-- body/sender_user_id/conversation_id (vendor_messages). Até aqui a única defesa era
-- o contrato da API (Zod nunca aceita esses campos) — decisão explicitamente revista:
-- agora também defendido em profundidade DENTRO do banco, sem depender de nenhuma
-- rota nunca esquecer a whitelist.
--
-- Abordagem: trigger BEFORE UPDATE que reescreve os campos privilegiados de volta
-- pro valor OLD sempre que quem está escrevendo não é nem o service role (webhook,
-- cron) nem um admin (fn_is_admin) — os dois únicos "portões" que already decidiam
-- isso via RLS (a policy "admins can update any..." e a ausência de qualquer policy
-- pra service_role, que ignora RLS de qualquer forma). Preferido a uma segunda
-- policy de UPDATE restritiva (Postgres RLS não tem como negar update de UMA coluna
-- mas permitir outras na MESMA linha/comando) ou a uma function/RPC separada (exigiria
-- reescrever as rotas de autoedição já existentes e ainda deixaria a tabela editável
-- livremente por qualquer client com a chave anon, se algum dia escrever direto).
-- auth.role() é a function padrão do Supabase Auth pra ler o claim "role" do JWT
-- ('anon' | 'authenticated' | 'service_role') — mesma idade/precedente de auth.uid(),
-- já usado em toda RLS deste projeto.

CREATE OR REPLACE FUNCTION fn_protect_vendor_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR fn_is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.status           := OLD.status;
  NEW.featured         := OLD.featured;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.deleted_at       := OLD.deleted_at;
  NEW.user_id          := OLD.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_profiles_protect_privileged_fields
  BEFORE UPDATE ON vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_protect_vendor_profile_privileged_fields();

-- Mesma lógica pra vendor_messages: só deleted_at (soft delete) pode mudar num
-- UPDATE feito pelo próprio remetente — body/sender_user_id/conversation_id/
-- created_at ficam travados no valor original, não importa o que o UPDATE tentar
-- gravar (mesmo que a API um dia aceite um body maior por engano).
CREATE OR REPLACE FUNCTION fn_protect_vendor_message_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR fn_is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.conversation_id := OLD.conversation_id;
  NEW.sender_user_id  := OLD.sender_user_id;
  NEW.body            := OLD.body;
  NEW.created_at       := OLD.created_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_messages_protect_immutable_fields
  BEFORE UPDATE ON vendor_messages
  FOR EACH ROW EXECUTE FUNCTION fn_protect_vendor_message_immutable_fields();
