-- Não escolhe um lado nem apaga dados de contas híbridas antigas.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE EXISTS (SELECT 1 FROM public.weddings w WHERE w.user_id = vp.user_id)
       OR EXISTS (SELECT 1 FROM public.wedding_members wm WHERE wm.user_id = vp.user_id)
  ) THEN
    RAISE EXCEPTION 'Existem contas com fornecedor e casamento. Separe os dados em contas com e-mails diferentes antes de aplicar esta migration.';
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN account_type TEXT CHECK (account_type IN ('couple', 'vendor'));
UPDATE public.profiles p SET account_type = CASE
  WHEN EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.user_id = p.id) THEN 'vendor'
  ELSE 'couple' END;

-- O tipo escolhido na criação é independente de profiles.role (admin/user).
CREATE OR REPLACE FUNCTION public.fn_on_user_created() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, account_type)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.raw_user_meta_data->>'account_type' IN ('couple', 'vendor')
      THEN NEW.raw_user_meta_data->>'account_type' ELSE NULL END);
  INSERT INTO public.subscriptions(user_id, plan_id, status) VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.fn_protect_account_type() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.account_type IS NOT NULL AND NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'ACCOUNT_TYPE_CONFLICT: o tipo de conta é permanente; use outro e-mail' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_account_type BEFORE UPDATE OF account_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_account_type();

-- Usada no callback OAuth: uma conta nova ainda sem tipo escolhe seu primeiro fluxo.
CREATE FUNCTION public.fn_claim_account_type(p_type TEXT) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_type IS NULL OR p_type NOT IN ('couple','vendor') THEN
    RAISE EXCEPTION 'Tipo de conta inválido' USING ERRCODE = '42501';
  END IF;
  SELECT account_type INTO v_type FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = '42501'; END IF;
  IF v_type IS NOT NULL AND v_type <> p_type THEN
    RAISE EXCEPTION 'ACCOUNT_TYPE_CONFLICT: use outro e-mail para este tipo de conta' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL THEN UPDATE public.profiles SET account_type = p_type WHERE id = auth.uid(); END IF;
  RETURN p_type;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_claim_account_type(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_claim_account_type(TEXT) TO authenticated;

-- Serializa a escolha pela mesma linha de profiles: inserts concorrentes em
-- weddings/vendor_profiles nunca conseguem transformar uma conta em híbrida.
CREATE FUNCTION public.fn_enforce_domain_account_type() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type TEXT; v_expected TEXT;
BEGIN
  v_expected := CASE WHEN TG_TABLE_NAME = 'vendor_profiles' THEN 'vendor' ELSE 'couple' END;
  SELECT account_type INTO v_type FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = '42501'; END IF;
  IF v_type IS NOT NULL AND v_type <> v_expected THEN
    RAISE EXCEPTION 'ACCOUNT_TYPE_CONFLICT: noivos e fornecedores precisam de e-mails diferentes' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL THEN UPDATE public.profiles SET account_type = v_expected WHERE id = NEW.user_id; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_vendor_account_type BEFORE INSERT OR UPDATE OF user_id ON public.vendor_profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_domain_account_type();
CREATE TRIGGER trg_wedding_account_type BEFORE INSERT OR UPDATE OF user_id ON public.weddings
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_domain_account_type();
CREATE TRIGGER trg_member_account_type BEFORE INSERT OR UPDATE OF user_id ON public.wedding_members
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_domain_account_type();

CREATE FUNCTION public.fn_account_type_for_email(p_email TEXT) RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.account_type FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(trim(p_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_account_type_for_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_account_type_for_email(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.fn_protect_account_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_enforce_domain_account_type() FROM PUBLIC;
