-- Correção de regressão: fn_protect_vendor_profile_privileged_fields()
-- (20260831000001) travou status no valor OLD pra qualquer escritor que não seja
-- service_role/admin — mas isso inclui a ÚNICA transição de status que o PRÓPRIO
-- fornecedor tem permissão de disparar (POST /api/v1/vendor/submit-for-review:
-- draft/rejected -> pending_review), que passou a ser silenciosamente revertida.
-- fornecedor nunca mais conseguia enviar o cadastro pra análise depois daquela
-- migration. Corrige liberando EXATAMENTE essa transição (e só ela) mesmo pra quem
-- não é admin/service_role — qualquer outro valor de status continua travado.
CREATE OR REPLACE FUNCTION fn_protect_vendor_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR fn_is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NOT (OLD.status IN ('draft', 'rejected') AND NEW.status = 'pending_review') THEN
    NEW.status := OLD.status;
  END IF;

  NEW.featured         := OLD.featured;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.deleted_at       := OLD.deleted_at;
  NEW.user_id          := OLD.user_id;

  RETURN NEW;
END;
$$;
