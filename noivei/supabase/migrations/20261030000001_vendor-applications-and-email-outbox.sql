-- Solicitações exigem CNPJ, inclusive quando a API é contornada.
-- NOT VALID preserva registros antigos; novas gravações precisam do documento.
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_cnpj_required
CHECK (cnpj IS NOT NULL AND upper(regexp_replace(cnpj, '[./[:space:]-]', '', 'g')) ~ '^[A-Z0-9]{12}[0-9]{2}$') NOT VALID;

-- Uma entrega independente para cada destinatário. Eventos são gravados na mesma
-- transação da mudança de status, inclusive nas alterações feitas direto no banco.
CREATE TABLE public.vendor_email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  recipient TEXT NOT NULL CHECK (recipient IN ('admin', 'vendor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.vendor_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_email_outbox FROM anon, authenticated;
GRANT ALL ON public.vendor_email_outbox TO service_role;
CREATE INDEX vendor_email_outbox_pending ON public.vendor_email_outbox(retry_at) WHERE sent_at IS NULL;

CREATE FUNCTION public.fn_queue_vendor_status_email() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('pending_review', 'active', 'rejected', 'suspended', 'paused') THEN
    INSERT INTO public.vendor_email_outbox(vendor_id, user_id, business_name, status, reason, recipient)
    SELECT NEW.id, NEW.user_id, NEW.business_name, NEW.status, NEW.rejection_reason, recipient
    FROM unnest(ARRAY['admin', 'vendor']) AS recipient;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_queue_vendor_status_email() FROM PUBLIC;
CREATE TRIGGER trg_queue_vendor_status_email AFTER UPDATE OF status ON public.vendor_profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_queue_vendor_status_email();

-- Lease de 10 minutos: duas execuções concorrentes não enviam o mesmo lote.
-- Se a execução morrer, o cron pode retomar. Entrega é ao menos uma vez.
CREATE FUNCTION public.fn_claim_vendor_emails(p_vendor_id UUID DEFAULT NULL)
RETURNS SETOF public.vendor_email_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.vendor_email_outbox SET retry_at = now() + interval '10 minutes', attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM public.vendor_email_outbox
    WHERE sent_at IS NULL AND retry_at <= now() AND (p_vendor_id IS NULL OR vendor_id = p_vendor_id)
    ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.fn_claim_vendor_emails(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_vendor_emails(UUID) TO service_role;

-- Impede contratar via REST direto antes da aprovação, além da proteção da API.
CREATE POLICY "vendor checkout requires approval" ON public.vendor_payment_checkouts
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.status IN ('active', 'paused')));

CREATE OR REPLACE FUNCTION public.fn_can_access_conversation(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_conversations vc WHERE vc.id = p_conversation_id AND (
      fn_has_module_access(vc.wedding_id, p_user_id, 'fornecedores') OR
      EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vc.vendor_id AND vp.user_id = p_user_id AND vp.status IN ('active', 'paused'))
    )
  );
$$;
DROP POLICY "participants can read own conversation" ON public.vendor_conversations;
CREATE POLICY "participants can read own conversation" ON public.vendor_conversations FOR SELECT
USING (public.fn_can_access_conversation(id, auth.uid()));
