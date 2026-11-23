INSERT INTO public.plan_module_access (plan_id, module, enabled)
SELECT id, 'site', true FROM public.plans WHERE id = 'free'
ON CONFLICT (plan_id, module) DO UPDATE SET enabled = EXCLUDED.enabled;

CREATE OR REPLACE FUNCTION public.fn_protect_exclusive_site_template() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_id text := COALESCE(public.fn_resolve_wedding_plan(NEW.wedding_id), 'free');
BEGIN
  IF TG_OP = 'INSERT' OR NEW.template IS DISTINCT FROM OLD.template OR NEW.wedding_id IS DISTINCT FROM OLD.wedding_id THEN
    IF NEW.template IN ('invitation', 'enveloped') AND plan_id NOT IN ('premium_plus_monthly', 'premium_plus_once') THEN
      RAISE EXCEPTION 'Estilo disponível apenas no plano Exclusivo' USING ERRCODE = '42501';
    END IF;
    IF NEW.template IN ('portfolio', 'editorial', 'garden') AND plan_id NOT IN ('premium_monthly', 'premium_once', 'premium_plus_monthly', 'premium_plus_once') THEN
      RAISE EXCEPTION 'Estilo disponível a partir do plano Ideal' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(btrim(NEW.content->>'envelope_monogram'), '') IS NOT NULL
    AND plan_id NOT IN ('premium_monthly', 'premium_once', 'premium_plus_monthly', 'premium_plus_once')
    AND (TG_OP = 'INSERT' OR NEW.content->'envelope_monogram' IS DISTINCT FROM OLD.content->'envelope_monogram' OR NEW.wedding_id IS DISTINCT FROM OLD.wedding_id)
  THEN
    RAISE EXCEPTION 'Monograma disponível a partir do plano Ideal' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER trg_protect_exclusive_site_template ON public.site_config;
CREATE TRIGGER trg_protect_exclusive_site_template BEFORE INSERT OR UPDATE OF template, wedding_id, content ON public.site_config
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_exclusive_site_template();

UPDATE public.plan_feature_values AS v
SET value = CASE v.group_key
  WHEN 'free' THEN 'Clássico e Fotográfico'
  WHEN 'premium' THEN 'Clássico, Fotográfico, Portfólio, Editorial e Jardim Romântico'
  WHEN 'plus' THEN 'Todos os estilos, incluindo Convite Selado e Envelopado'
END
FROM public.plan_features AS f
WHERE f.id = v.feature_id AND f.label = 'Estilo do site' AND v.group_key IN ('free', 'premium', 'plus');

UPDATE public.plan_feature_values AS v
SET value = '✅'
FROM public.plan_features AS f
WHERE f.id = v.feature_id AND f.label = 'Site do casal' AND v.group_key = 'free';
