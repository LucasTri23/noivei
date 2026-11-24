-- =========================================================
-- Personalização do site do casal.
--
-- Só ADITIVA e idempotente:
--   * wedding_gallery_photos.purpose ganha 'brand' — imagem do monograma.
--     Como as fotos da história, fica fora da galeria e do teto de fotos do
--     estilo, mas soma na cota de armazenamento e entra na exportação de dados.
--   * A trava de plano do site (fn_protect_exclusive_site_template) passa a
--     cobrir os recursos pagos novos guardados em site_config.content:
--     monogram_image_url, font_pair, palette.tone, palette.seal e lodging.
--     Mesma regra do monograma em texto: bloqueia ATIVAR/MUDAR sem plano;
--     manter um valor salvo antes de um downgrade não é erro.
--   * Perguntas frequentes, ordem/visibilidade das seções e cor de destaque
--     são livres em todos os planos — sem trava aqui.
-- Depende de 20261118000002 (coluna purpose) e 20261123000002 (trigger atual).
-- =========================================================

-- ── 1. Finalidade 'brand' ──
ALTER TABLE public.wedding_gallery_photos DROP CONSTRAINT IF EXISTS wedding_gallery_photos_purpose_check;
ALTER TABLE public.wedding_gallery_photos
  ADD CONSTRAINT wedding_gallery_photos_purpose_check CHECK (purpose IN ('gallery', 'story', 'brand'));

-- ── 2. Trava de plano dos recursos pagos do site ──
CREATE OR REPLACE FUNCTION public.fn_protect_exclusive_site_template() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_id   text    := COALESCE(public.fn_resolve_wedding_plan(NEW.wedding_id), 'free');
  is_paid   boolean := plan_id IN ('premium_monthly', 'premium_once', 'premium_plus_monthly', 'premium_plus_once');
  is_insert boolean := TG_OP = 'INSERT';
  moved     boolean := TG_OP = 'UPDATE' AND NEW.wedding_id IS DISTINCT FROM OLD.wedding_id;
  v_key     text;
  v_new     jsonb;
  v_old     jsonb;
BEGIN
  IF is_insert OR NEW.template IS DISTINCT FROM OLD.template OR moved THEN
    IF NEW.template IN ('invitation', 'enveloped') AND plan_id NOT IN ('premium_plus_monthly', 'premium_plus_once') THEN
      RAISE EXCEPTION 'Estilo disponível apenas no plano Exclusivo' USING ERRCODE = '42501';
    END IF;
    IF NEW.template IN ('portfolio', 'editorial', 'garden') AND NOT is_paid THEN
      RAISE EXCEPTION 'Estilo disponível a partir do plano Ideal' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF is_paid THEN
    RETURN NEW;
  END IF;

  -- Caminhos no JSON de content que exigem plano pago. Vazio/nulo não conta.
  FOREACH v_key IN ARRAY ARRAY['envelope_monogram', 'monogram_image_url', 'font_pair', 'palette.tone', 'palette.seal', 'lodging'] LOOP
    v_new := NEW.content #> string_to_array(v_key, '.');
    v_old := CASE WHEN is_insert THEN NULL ELSE OLD.content #> string_to_array(v_key, '.') END;

    IF v_new IS NOT NULL
      AND v_new <> 'null'::jsonb
      AND v_new <> '""'::jsonb
      AND v_new <> '[]'::jsonb
      AND NOT (jsonb_typeof(v_new) = 'string' AND btrim(v_new #>> '{}') = '')
      AND (is_insert OR moved OR v_new IS DISTINCT FROM v_old)
    THEN
      RAISE EXCEPTION 'Recurso do site disponível a partir do plano Ideal (%)', v_key USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- O trigger de 20261123000002 já dispara em UPDATE OF content; recriado só
-- para garantir a definição caso aquela migration tenha sido ajustada à mão.
DROP TRIGGER IF EXISTS trg_protect_exclusive_site_template ON public.site_config;
CREATE TRIGGER trg_protect_exclusive_site_template BEFORE INSERT OR UPDATE OF template, wedding_id, content ON public.site_config
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_exclusive_site_template();
