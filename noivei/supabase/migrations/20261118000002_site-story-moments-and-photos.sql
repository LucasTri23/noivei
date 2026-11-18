-- =========================================================
-- Nossa História: momentos e fotos da história.
--
-- Só ADITIVA e idempotente. Nenhum registro existente é alterado além do
-- DEFAULT das colunas novas:
--   * wedding_gallery_photos.purpose ('gallery' | 'story'): toda linha existente
--     vira 'gallery' (comportamento atual intacto). Fotos 'story' continuam no
--     mesmo bucket "wedding-photos", na mesma convenção de path e na mesma
--     tabela — por isso seguem somando na cota de armazenamento do plano
--     (checkStorageLimit), no purge de contas e na exportação, sem nada novo.
--     A galeria pública e o teto de fotos por estilo passam a considerar só
--     purpose = 'gallery' (feito na API/loader).
--   * width/height: dimensões da imagem otimizada, para reservar a proporção no
--     site público (sem deslocamento de layout). Nulas em fotos antigas.
--   * site_story_moments / site_story_photos: momentos da história e metadados
--     das fotos da história (legenda, momento, ordem).
--
-- Mesmo casamento garantido NO BANCO por chave estrangeira composta
-- (id, wedding_id): uma foto/momento de outro casamento simplesmente não
-- satisfaz a FK — não depende só da API.
-- Teto: 20 momentos e 24 fotos de história por casamento.
-- =========================================================

-- ── 1. wedding_gallery_photos: finalidade e dimensões ──
ALTER TABLE public.wedding_gallery_photos
  ADD COLUMN IF NOT EXISTS purpose TEXT    NOT NULL DEFAULT 'gallery',
  ADD COLUMN IF NOT EXISTS width   INTEGER,
  ADD COLUMN IF NOT EXISTS height  INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wedding_gallery_photos_purpose_check') THEN
    ALTER TABLE public.wedding_gallery_photos
      ADD CONSTRAINT wedding_gallery_photos_purpose_check CHECK (purpose IN ('gallery', 'story'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wedding_gallery_photos_dimensions_check') THEN
    ALTER TABLE public.wedding_gallery_photos
      ADD CONSTRAINT wedding_gallery_photos_dimensions_check CHECK (
        (width IS NULL OR width BETWEEN 1 AND 20000) AND (height IS NULL OR height BETWEEN 1 AND 20000)
      );
  END IF;
  -- Alvo das FKs compostas abaixo (id já é PK; o par só existe para a FK).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wedding_gallery_photos_id_wedding_key') THEN
    ALTER TABLE public.wedding_gallery_photos
      ADD CONSTRAINT wedding_gallery_photos_id_wedding_key UNIQUE (id, wedding_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wedding_gallery_photos_wedding_purpose
  ON public.wedding_gallery_photos(wedding_id, purpose);

-- A finalidade é definida no registro e não muda depois: impede, por exemplo,
-- transformar foto de história em foto de galeria para furar o teto do estilo
-- (a policy de UPDATE da tabela existe para position_y/fit_contain).
CREATE OR REPLACE FUNCTION public.fn_wedding_gallery_photos_lock_purpose()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.wedding_id IS DISTINCT FROM OLD.wedding_id THEN
    RAISE EXCEPTION 'A finalidade e o casamento de uma foto não podem ser alterados.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wedding_gallery_photos_lock_purpose ON public.wedding_gallery_photos;
CREATE TRIGGER trg_wedding_gallery_photos_lock_purpose
  BEFORE UPDATE OF purpose, wedding_id ON public.wedding_gallery_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_wedding_gallery_photos_lock_purpose();

-- ── 2. site_story_moments ──
CREATE TABLE IF NOT EXISTS public.site_story_moments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id     UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  title          TEXT,
  description    TEXT,
  happened_on    DATE,
  date_precision TEXT NOT NULL DEFAULT 'day',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_story_moments_id_wedding_key   UNIQUE (id, wedding_id),
  CONSTRAINT site_story_moments_title_length       CHECK (title IS NULL OR char_length(title) <= 120),
  CONSTRAINT site_story_moments_description_length CHECK (description IS NULL OR char_length(description) <= 2000),
  CONSTRAINT site_story_moments_date_precision     CHECK (date_precision IN ('day', 'month', 'year')),
  CONSTRAINT site_story_moments_sort_order         CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_site_story_moments_wedding_sort
  ON public.site_story_moments(wedding_id, sort_order);

DROP TRIGGER IF EXISTS trg_site_story_moments_updated_at ON public.site_story_moments;
CREATE TRIGGER trg_site_story_moments_updated_at
  BEFORE UPDATE ON public.site_story_moments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE public.site_story_moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read wedding story moments"   ON public.site_story_moments;
DROP POLICY IF EXISTS "members can insert wedding story moments" ON public.site_story_moments;
DROP POLICY IF EXISTS "members can update wedding story moments" ON public.site_story_moments;
DROP POLICY IF EXISTS "members can delete wedding story moments" ON public.site_story_moments;
CREATE POLICY "members can read wedding story moments"   ON public.site_story_moments FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can insert wedding story moments" ON public.site_story_moments FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can update wedding story moments" ON public.site_story_moments FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'site')) WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can delete wedding story moments" ON public.site_story_moments FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));

-- ── 3. site_story_photos ──
-- photo_id é a própria linha de wedding_gallery_photos (purpose = 'story'):
-- apagar a foto (API de galeria, que remove do Storage antes) apaga em
-- cascata estes metadados. Apagar um momento só desvincula as fotos dele.
CREATE TABLE IF NOT EXISTS public.site_story_photos (
  photo_id    UUID PRIMARY KEY,
  wedding_id  UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  moment_id   UUID,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_story_photos_photo_fk
    FOREIGN KEY (photo_id, wedding_id) REFERENCES public.wedding_gallery_photos(id, wedding_id) ON DELETE CASCADE,
  -- SET NULL só em moment_id (PostgreSQL 15+): wedding_id continua preenchido.
  CONSTRAINT site_story_photos_moment_fk
    FOREIGN KEY (moment_id, wedding_id) REFERENCES public.site_story_moments(id, wedding_id) ON DELETE SET NULL (moment_id),
  CONSTRAINT site_story_photos_caption_length CHECK (caption IS NULL OR char_length(caption) <= 200),
  CONSTRAINT site_story_photos_sort_order     CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_site_story_photos_wedding_sort ON public.site_story_photos(wedding_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_site_story_photos_moment_id    ON public.site_story_photos(moment_id);

DROP TRIGGER IF EXISTS trg_site_story_photos_updated_at ON public.site_story_photos;
CREATE TRIGGER trg_site_story_photos_updated_at
  BEFORE UPDATE ON public.site_story_photos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE public.site_story_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read wedding story photos"   ON public.site_story_photos;
DROP POLICY IF EXISTS "members can insert wedding story photos" ON public.site_story_photos;
DROP POLICY IF EXISTS "members can update wedding story photos" ON public.site_story_photos;
DROP POLICY IF EXISTS "members can delete wedding story photos" ON public.site_story_photos;
CREATE POLICY "members can read wedding story photos"   ON public.site_story_photos FOR SELECT USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can insert wedding story photos" ON public.site_story_photos FOR INSERT WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can update wedding story photos" ON public.site_story_photos FOR UPDATE USING (fn_has_module_access(wedding_id, auth.uid(), 'site')) WITH CHECK (fn_has_module_access(wedding_id, auth.uid(), 'site'));
CREATE POLICY "members can delete wedding story photos" ON public.site_story_photos FOR DELETE USING (fn_has_module_access(wedding_id, auth.uid(), 'site'));

-- ── 4. Regras de integridade: finalidade da foto + tetos ──
-- Lock transacional por casamento evita que dois inserts simultâneos furem o teto.
CREATE OR REPLACE FUNCTION public.fn_site_story_photos_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.wedding_gallery_photos
     WHERE id = NEW.photo_id AND wedding_id = NEW.wedding_id AND purpose = 'story'
  ) THEN
    RAISE EXCEPTION 'A foto informada não é uma foto da história deste casamento.' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('site_story_photos:' || NEW.wedding_id::text, 0));
    IF (SELECT count(*) FROM public.site_story_photos WHERE wedding_id = NEW.wedding_id) >= 24 THEN
      RAISE EXCEPTION 'Limite de 24 fotos na história atingido.' USING ERRCODE = 'P0001', HINT = 'STORY_PHOTO_LIMIT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_story_photos_check ON public.site_story_photos;
CREATE TRIGGER trg_site_story_photos_check
  BEFORE INSERT OR UPDATE OF photo_id, wedding_id ON public.site_story_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_site_story_photos_check();

CREATE OR REPLACE FUNCTION public.fn_site_story_moments_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('site_story_moments:' || NEW.wedding_id::text, 0));
  IF (SELECT count(*) FROM public.site_story_moments WHERE wedding_id = NEW.wedding_id) >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 momentos na história atingido.' USING ERRCODE = 'P0001', HINT = 'STORY_MOMENT_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_story_moments_limit ON public.site_story_moments;
CREATE TRIGGER trg_site_story_moments_limit
  BEFORE INSERT ON public.site_story_moments
  FOR EACH ROW EXECUTE FUNCTION public.fn_site_story_moments_limit();

-- ── 5. Reordenação atômica ──
-- Recebe a lista COMPLETA de ids (momentos ou fotos da história) do casamento,
-- na ordem final. SECURITY INVOKER: a RLS das tabelas vale normalmente; a
-- checagem de módulo aqui só dá um erro claro em vez de "0 linhas".
CREATE OR REPLACE FUNCTION public.fn_reorder_site_story(p_wedding_id UUID, p_kind TEXT, p_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_total INTEGER;
BEGIN
  IF NOT COALESCE(fn_has_module_access(p_wedding_id, auth.uid(), 'site'), false) THEN
    RAISE EXCEPTION 'Sem acesso ao site deste casamento.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('moments', 'photos') OR cardinality(p_ids) IS NULL OR cardinality(p_ids) > 50
     OR cardinality(p_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x) THEN
    RAISE EXCEPTION 'Lista para reordenação inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'moments' THEN
    SELECT count(*) INTO v_total FROM site_story_moments WHERE wedding_id = p_wedding_id;
    IF v_total <> cardinality(p_ids)
       OR (SELECT count(*) FROM site_story_moments WHERE wedding_id = p_wedding_id AND id = ANY(p_ids)) <> v_total THEN
      RAISE EXCEPTION 'A lista precisa conter todos os momentos deste casamento.' USING ERRCODE = '22023';
    END IF;
    UPDATE site_story_moments m SET sort_order = o.pos - 1
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, pos)
     WHERE m.id = o.id AND m.wedding_id = p_wedding_id;
  ELSE
    SELECT count(*) INTO v_total FROM site_story_photos WHERE wedding_id = p_wedding_id;
    IF v_total <> cardinality(p_ids)
       OR (SELECT count(*) FROM site_story_photos WHERE wedding_id = p_wedding_id AND photo_id = ANY(p_ids)) <> v_total THEN
      RAISE EXCEPTION 'A lista precisa conter todas as fotos da história deste casamento.' USING ERRCODE = '22023';
    END IF;
    UPDATE site_story_photos p SET sort_order = o.pos - 1
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, pos)
     WHERE p.photo_id = o.id AND p.wedding_id = p_wedding_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_reorder_site_story(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reorder_site_story(UUID, TEXT, UUID[]) TO authenticated;

-- ── 6. Registro atômico de foto da história ──
-- Cria a linha em wedding_gallery_photos (purpose = 'story') e os metadados em
-- site_story_photos na MESMA transação: se o teto de 24 ou a FK do momento
-- falharem, nada fica registrado pela metade. O tamanho real do objeto e a cota
-- do plano são conferidos pela API antes de chamar (mesma regra da galeria).
CREATE OR REPLACE FUNCTION public.fn_add_site_story_photo(
  p_wedding_id   UUID,
  p_storage_path TEXT,
  p_size_bytes   BIGINT,
  p_mime_type    TEXT,
  p_width        INTEGER,
  p_height       INTEGER,
  p_caption      TEXT,
  p_moment_id    UUID
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_photo_id UUID;
  v_next     INTEGER;
BEGIN
  IF NOT COALESCE(fn_has_module_access(p_wedding_id, auth.uid(), 'site'), false) THEN
    RAISE EXCEPTION 'Sem acesso ao site deste casamento.' USING ERRCODE = '42501';
  END IF;
  IF p_storage_path IS NULL OR left(p_storage_path, length(p_wedding_id::text) + 1) <> p_wedding_id::text || '/' THEN
    RAISE EXCEPTION 'Caminho de armazenamento inválido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO wedding_gallery_photos (wedding_id, storage_path, size_bytes, mime_type, uploaded_by, purpose, width, height)
  VALUES (p_wedding_id, p_storage_path, p_size_bytes, p_mime_type, auth.uid(), 'story', p_width, p_height)
  RETURNING id INTO v_photo_id;

  SELECT COALESCE(max(sort_order) + 1, 0) INTO v_next FROM site_story_photos WHERE wedding_id = p_wedding_id;

  INSERT INTO site_story_photos (photo_id, wedding_id, moment_id, caption, sort_order)
  VALUES (v_photo_id, p_wedding_id, p_moment_id, NULLIF(trim(p_caption), ''), v_next);

  RETURN v_photo_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_add_site_story_photo(UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_add_site_story_photo(UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, TEXT, UUID) TO authenticated;
