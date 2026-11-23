ALTER TABLE public.site_config DROP CONSTRAINT IF EXISTS site_config_template_check;
ALTER TABLE public.site_config ADD CONSTRAINT site_config_template_check
CHECK (template IN ('classic', 'portfolio', 'editorial', 'garden', 'invitation', 'enveloped', 'photographic'));

-- Proteção independente da interface e da API, inclusive em chamadas REST diretas.
CREATE OR REPLACE FUNCTION public.fn_protect_exclusive_site_template() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.template IN ('editorial', 'garden', 'invitation', 'enveloped', 'photographic') AND
    COALESCE(public.fn_resolve_wedding_plan(NEW.wedding_id), 'free') NOT IN ('premium_plus_monthly', 'premium_plus_once')
  THEN
    RAISE EXCEPTION 'Estilo disponível apenas no plano Exclusivo' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
