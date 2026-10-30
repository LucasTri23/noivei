-- Consulta exata de identidade restrita ao servidor. Nunca expõe auth.users ao browser.
CREATE FUNCTION public.fn_vendor_account_by_email(p_email TEXT) RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_vendor_account_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vendor_account_by_email(TEXT) TO service_role;

-- Perfil, categorias, aprovação, auditoria e fila de e-mails na mesma transação.
CREATE FUNCTION public.fn_admin_create_vendor(p_user_id UUID, p_profile JSONB, p_category_ids UUID[], p_slug TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vendor_id UUID;
BEGIN
  IF NOT COALESCE(public.fn_is_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR length(trim(COALESCE(p_profile->>'business_name', ''))) < 2
    OR cardinality(p_category_ids) IS NULL OR cardinality(p_category_ids) < 1 OR cardinality(p_category_ids) > 20
    OR (SELECT count(*) FROM public.vendor_categories WHERE id = ANY(p_category_ids) AND active) <> cardinality(p_category_ids)
  THEN
    RAISE EXCEPTION 'Informe empresa e categorias ativas válidas' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_profiles(user_id, business_name, cnpj, slug, status, description, phone, whatsapp, show_whatsapp, instagram, website, city, state, price_range)
  VALUES (p_user_id, trim(p_profile->>'business_name'), p_profile->>'cnpj', p_slug, 'draft',
    p_profile->>'description', p_profile->>'phone', p_profile->>'whatsapp', COALESCE((p_profile->>'show_whatsapp')::boolean, false),
    p_profile->>'instagram', p_profile->>'website', p_profile->>'city', p_profile->>'state', p_profile->>'price_range')
  RETURNING id INTO v_vendor_id;

  INSERT INTO public.vendor_category_links(vendor_id, category_id)
  SELECT v_vendor_id, unnest(p_category_ids);
  UPDATE public.vendor_profiles SET status = 'active' WHERE id = v_vendor_id;
  INSERT INTO public.vendor_admin_actions(admin_id, vendor_id, action, reason)
  VALUES (auth.uid(), v_vendor_id, 'create', 'Fornecedor cadastrado e aprovado pelo administrador');
  RETURN v_vendor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_create_vendor(UUID, JSONB, UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_create_vendor(UUID, JSONB, UUID[], TEXT) TO authenticated;
