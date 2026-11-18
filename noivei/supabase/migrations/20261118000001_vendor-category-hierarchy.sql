-- =========================================================
-- Hierarquia de categorias de fornecedor (principal → subcategoria).
--
-- Só ADITIVA e idempotente (pode rodar mais de uma vez sem efeito colateral):
--   * vendor_categories ganha parent_id / description / updated_at.
--     parent_id NULL  = categoria principal (agrupador, nunca recebe fornecedor)
--     parent_id NOT NULL = subcategoria (é nela que o fornecedor se vincula)
--   * As 12 categorias originais são REAPROVEITADAS (mesmo id, mesmo slug) —
--     nenhum vínculo de fornecedor é apagado ou recriado; slugs nunca mudam
--     (o checklist e URLs antigas ?categoria=<slug> dependem deles).
--   * 'beleza' (cabelo + maquiagem) não tem equivalente 1:1: os vínculos são
--     COPIADOS para 'maquiagem' e 'cabelo_penteados' e a linha antiga fica
--     inativa (preservada, com os vínculos originais intactos).
--   * Categorias criadas manualmente pelo admin que não estão no seed:
--     se o nome bater (sem acento/caixa) com uma subcategoria nova, a linha
--     existente é reaproveitada no lugar de criar duplicata; senão vai para
--     "Serviços complementares" (listada em RAISE NOTICE) para reorganização.
--   * Nenhuma linha de vendor_profiles é tocada.
-- =========================================================

-- ── 1. Colunas novas ──
ALTER TABLE public.vendor_categories
  ADD COLUMN IF NOT EXISTS parent_id   UUID REFERENCES public.vendor_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_categories_parent_not_self') THEN
    ALTER TABLE public.vendor_categories
      ADD CONSTRAINT vendor_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_categories_description_length') THEN
    ALTER TABLE public.vendor_categories
      ADD CONSTRAINT vendor_categories_description_length CHECK (description IS NULL OR char_length(description) <= 500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_categories_parent_sort
  ON public.vendor_categories(parent_id, sort_order);

DROP TRIGGER IF EXISTS trg_vendor_categories_updated_at ON public.vendor_categories;
CREATE TRIGGER trg_vendor_categories_updated_at
  BEFORE UPDATE ON public.vendor_categories
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Normalização usada só para evitar duplicata por nome equivalente
-- ("Decoração de Cerimônia" == "decoracao de cerimonia"). Sem depender da
-- extensão unaccent, que não está habilitada no projeto.
CREATE OR REPLACE FUNCTION public.fn_normalize_category_label(p_label TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    lower(translate(trim(COALESCE(p_label, '')),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '\s+', ' ', 'g');
$$;

-- ── 2. Seed (principais + subcategorias) ──
CREATE TEMP TABLE _vc_groups (slug TEXT PRIMARY KEY, label TEXT, sort_order INT, description TEXT) ON COMMIT DROP;
INSERT INTO _vc_groups VALUES
  ('gastronomia_bebidas',     'Gastronomia e bebidas',             0, 'Buffet, bolos, doces, bebidas e experiências gastronômicas.'),
  ('moda_acessorios',         'Moda e acessórios',                 1, 'Trajes, alfaiataria, calçados, joias e acessórios.'),
  ('beleza_estetica',         'Beleza e estética',                 2, 'Maquiagem, cabelo, dia da noiva/noivo e cuidados pessoais.'),
  ('fotografia_audiovisual',  'Fotografia e audiovisual',          3, 'Fotografia, filmagem, ensaios, drone e transmissão.'),
  ('decoracao_ambientacao',   'Decoração e ambientação',           4, 'Flores, decoração, mobiliário, iluminação e cenografia.'),
  ('musica_entretenimento',   'Música e entretenimento',           5, 'DJ, bandas, músicos, som, luz e atrações.'),
  ('espacos_infraestrutura',  'Espaços e infraestrutura',          6, 'Locais para o casamento e estrutura do evento.'),
  ('organizacao_cerimonia',   'Organização e cerimônia',           7, 'Assessoria, cerimonial, celebrantes e equipe do evento.'),
  ('convites_papelaria',      'Convites, papelaria e lembranças',  8, 'Convites, identidade visual, lembrancinhas e presentes.'),
  ('transporte_hospedagem',   'Transporte e hospedagem',           9, 'Carro dos noivos, transporte, hospedagem e viagens.'),
  ('servicos_complementares', 'Serviços complementares',          10, 'Recreação infantil, montagem, limpeza e outros serviços.');

CREATE TEMP TABLE _vc_subs (group_slug TEXT, slug TEXT PRIMARY KEY, label TEXT, sort_order INT) ON COMMIT DROP;
INSERT INTO _vc_subs VALUES
  -- Gastronomia e bebidas
  ('gastronomia_bebidas', 'buffet',                            'Buffet',                               0),
  ('gastronomia_bebidas', 'bolo',                              'Bolos de casamento',                   1),
  ('gastronomia_bebidas', 'doces',                             'Doces e bem-casados',                  2),
  ('gastronomia_bebidas', 'chocolates_lembrancas_comestiveis', 'Chocolates e lembranças comestíveis',  3),
  ('gastronomia_bebidas', 'bartenders_coquetelaria',           'Bartenders e coquetelaria',            4),
  ('gastronomia_bebidas', 'bares_bebidas',                     'Bares e bebidas',                      5),
  ('gastronomia_bebidas', 'estacoes_gastronomicas',            'Estações gastronômicas',               6),
  ('gastronomia_bebidas', 'cafeteria_carrinhos_gourmet',       'Cafeteria e carrinhos gourmet',        7),
  -- Moda e acessórios
  ('moda_acessorios', 'vestidos_noiva',          'Vestidos de noiva',               0),
  ('moda_acessorios', 'ternos_trajes_noivo',     'Ternos e trajes do noivo',        1),
  ('moda_acessorios', 'vestidos_madrinhas',      'Vestidos para madrinhas',         2),
  ('moda_acessorios', 'trajes_padrinhos',        'Trajes para padrinhos',           3),
  ('moda_acessorios', 'roupas_daminhas_pajens',  'Roupas para daminhas e pajens',   4),
  ('moda_acessorios', 'alfaiataria_sob_medida',  'Alfaiataria e roupas sob medida', 5),
  ('moda_acessorios', 'aluguel_trajes',          'Aluguel de trajes',               6),
  ('moda_acessorios', 'sapatos_acessorios',      'Sapatos e acessórios',            7),
  ('moda_acessorios', 'joias_aliancas',          'Joias e alianças',                8),
  ('moda_acessorios', 'acessorios_cabelo_veus',  'Acessórios para cabelo e véus',   9),
  -- Beleza e estética
  ('beleza_estetica', 'maquiagem',                  'Maquiagem',                   0),
  ('beleza_estetica', 'cabelo_penteados',           'Cabelo e penteados',          1),
  ('beleza_estetica', 'dia_da_noiva',               'Dia da noiva',                2),
  ('beleza_estetica', 'dia_do_noivo',               'Dia do noivo',                3),
  ('beleza_estetica', 'barbearia',                  'Barbearia',                   4),
  ('beleza_estetica', 'manicure_unhas',             'Manicure e unhas',            5),
  ('beleza_estetica', 'estetica_cuidados_pessoais', 'Estética e cuidados pessoais', 6),
  -- Fotografia e audiovisual
  ('fotografia_audiovisual', 'fotografia',           'Fotografia',            0),
  ('fotografia_audiovisual', 'filmagem',             'Filmagem',              1),
  ('fotografia_audiovisual', 'pre_wedding',          'Pré-wedding',           2),
  ('fotografia_audiovisual', 'ensaios_fotograficos', 'Ensaios fotográficos',  3),
  ('fotografia_audiovisual', 'drone',                'Drone',                 4),
  ('fotografia_audiovisual', 'cabine_fotos',         'Cabine de fotos',       5),
  ('fotografia_audiovisual', 'plataforma_360',       'Plataforma 360°',       6),
  ('fotografia_audiovisual', 'edicao_videos',        'Edição de vídeos',      7),
  ('fotografia_audiovisual', 'transmissao_ao_vivo',  'Transmissão ao vivo',   8),
  -- Decoração e ambientação
  ('decoracao_ambientacao', 'flores_decoracao',      'Flores e decoração',     0),
  ('decoracao_ambientacao', 'buques',                'Buquês',                 1),
  ('decoracao_ambientacao', 'decoracao_cerimonia',   'Decoração de cerimônia', 2),
  ('decoracao_ambientacao', 'decoracao_recepcao',    'Decoração de recepção',  3),
  ('decoracao_ambientacao', 'mobiliario_locacao',    'Mobiliário e locação',   4),
  ('decoracao_ambientacao', 'iluminacao_decorativa', 'Iluminação decorativa',  5),
  ('decoracao_ambientacao', 'cenografia',            'Cenografia',             6),
  ('decoracao_ambientacao', 'papelaria_decorativa',  'Papelaria decorativa',   7),
  -- Música e entretenimento
  ('musica_entretenimento', 'dj',                      'DJ',                         0),
  ('musica_entretenimento', 'banda',                   'Banda',                      1),
  ('musica_entretenimento', 'musica_ao_vivo',          'Música ao vivo',             2),
  ('musica_entretenimento', 'musicos_cerimonia',       'Músicos para cerimônia',     3),
  ('musica_entretenimento', 'som_estrutura',           'Som e estrutura',            4),
  ('musica_entretenimento', 'iluminacao_cenica',       'Iluminação cênica',          5),
  ('musica_entretenimento', 'pista_danca',             'Pista de dança',             6),
  ('musica_entretenimento', 'atracoes_entretenimento', 'Atrações e entretenimento',  7),
  -- Espaços e infraestrutura
  ('espacos_infraestrutura', 'espacos_casamento',   'Espaços para casamento', 0),
  ('espacos_infraestrutura', 'sitios_chacaras',     'Sítios e chácaras',      1),
  ('espacos_infraestrutura', 'saloes_festas',       'Salões de festas',       2),
  ('espacos_infraestrutura', 'hoteis_resorts',      'Hotéis e resorts',       3),
  ('espacos_infraestrutura', 'tendas_coberturas',   'Tendas e coberturas',    4),
  ('espacos_infraestrutura', 'geradores',           'Geradores',              5),
  ('espacos_infraestrutura', 'climatizacao',        'Climatização',           6),
  ('espacos_infraestrutura', 'banheiros_moveis',    'Banheiros móveis',       7),
  ('espacos_infraestrutura', 'estruturas_eventos',  'Estruturas para eventos', 8),
  -- Organização e cerimônia
  ('organizacao_cerimonia', 'assessoria_cerimonial',  'Assessoria e cerimonial',    0),
  ('organizacao_cerimonia', 'organizacao_casamentos', 'Organização de casamentos',  1),
  ('organizacao_cerimonia', 'celebrantes',            'Celebrantes',                2),
  ('organizacao_cerimonia', 'mestre_cerimonias',      'Mestre de cerimônias',       3),
  ('organizacao_cerimonia', 'coordenacao_evento',     'Coordenação do evento',      4),
  ('organizacao_cerimonia', 'recepcionistas',         'Recepcionistas',             5),
  ('organizacao_cerimonia', 'seguranca',              'Segurança',                  6),
  ('organizacao_cerimonia', 'equipe_apoio',           'Equipe de apoio',            7),
  -- Convites, papelaria e lembranças
  ('convites_papelaria', 'convites_fisicos',          'Convites físicos',            0),
  ('convites_papelaria', 'convites_digitais',         'Convites digitais',           1),
  ('convites_papelaria', 'papelaria_personalizada',   'Papelaria personalizada',     2),
  ('convites_papelaria', 'identidade_visual',         'Identidade visual',           3),
  ('convites_papelaria', 'lembrancinhas',             'Lembrancinhas',               4),
  ('convites_papelaria', 'presentes_personalizados',  'Presentes personalizados',    5),
  ('convites_papelaria', 'brindes_padrinhos',         'Brindes para padrinhos',      6),
  ('convites_papelaria', 'caligrafia_personalizacao', 'Caligrafia e personalização', 7),
  -- Transporte e hospedagem
  ('transporte_hospedagem', 'carro_cerimonia',       'Carro da noiva e do noivo',  0),
  ('transporte_hospedagem', 'transporte_convidados', 'Transporte de convidados',   1),
  ('transporte_hospedagem', 'motoristas',            'Motoristas',                 2),
  ('transporte_hospedagem', 'locacao_veiculos',      'Locação de veículos',        3),
  ('transporte_hospedagem', 'hospedagem_convidados', 'Hospedagem de convidados',   4),
  ('transporte_hospedagem', 'hospedagem_lua_de_mel', 'Hospedagem para lua de mel', 5),
  ('transporte_hospedagem', 'agencias_viagens',      'Agências de viagens',        6),
  -- Serviços complementares
  ('servicos_complementares', 'recreacao_infantil',   'Recreação infantil',               0),
  ('servicos_complementares', 'monitores_infantis',   'Monitores infantis',               1),
  ('servicos_complementares', 'espaco_kids',          'Espaço kids',                      2),
  ('servicos_complementares', 'limpeza_pos_evento',   'Limpeza pós-evento',               3),
  ('servicos_complementares', 'servicos_montagem',    'Serviços de montagem',             4),
  ('servicos_complementares', 'servicos_desmontagem', 'Serviços de desmontagem',          5),
  ('servicos_complementares', 'outros_servicos',      'Outros serviços para casamentos', 99);

DO $$
DECLARE
  r            RECORD;
  v_group_id   UUID;
  v_existing   UUID;
  v_beleza_id  UUID;
  v_maq_id     UUID;
  v_cab_id     UUID;
  v_orphans    TEXT;
BEGIN
  -- 2a. Principais (slug estável; ON CONFLICT não sobrescreve edições do admin)
  INSERT INTO public.vendor_categories (slug, label, sort_order, description, parent_id)
  SELECT g.slug, g.label, g.sort_order, g.description, NULL FROM _vc_groups g
  ON CONFLICT (slug) DO NOTHING;

  -- 2b. Renomeações dos legados — só se o nome ainda for o original do seed
  --     (não desfaz um ajuste manual feito pelo admin).
  UPDATE public.vendor_categories SET label = 'Bolos de casamento'        WHERE slug = 'bolo'            AND label = 'Bolo';
  UPDATE public.vendor_categories SET label = 'Carro da noiva e do noivo' WHERE slug = 'carro_cerimonia' AND label = 'Carro da cerimônia';

  -- 2c. Subcategorias: reaproveita por slug → por nome equivalente → insere.
  FOR r IN SELECT s.*, g.sort_order AS group_sort FROM _vc_subs s JOIN _vc_groups g ON g.slug = s.group_slug LOOP
    SELECT id INTO v_group_id FROM public.vendor_categories WHERE slug = r.group_slug;

    SELECT id INTO v_existing FROM public.vendor_categories WHERE slug = r.slug;

    IF v_existing IS NULL THEN
      SELECT id INTO v_existing
        FROM public.vendor_categories c
       WHERE public.fn_normalize_category_label(c.label) = public.fn_normalize_category_label(r.label)
         AND c.slug NOT IN (SELECT slug FROM _vc_groups)
       ORDER BY c.created_at
       LIMIT 1;
    END IF;

    IF v_existing IS NULL THEN
      INSERT INTO public.vendor_categories (slug, label, sort_order, parent_id)
      VALUES (r.slug, r.label, r.sort_order, v_group_id);
    ELSE
      -- Só encaixa quem ainda não tem pai: numa segunda execução (ou depois do
      -- admin reorganizar) nada é sobrescrito.
      UPDATE public.vendor_categories
         SET parent_id = v_group_id, sort_order = r.sort_order
       WHERE id = v_existing AND parent_id IS NULL;
    END IF;
  END LOOP;

  -- 2d. 'beleza' → copia vínculos para Maquiagem + Cabelo e penteados e
  --     desativa a antiga (linha e vínculos originais preservados).
  SELECT id INTO v_beleza_id FROM public.vendor_categories WHERE slug = 'beleza' AND parent_id IS NULL;
  IF v_beleza_id IS NOT NULL THEN
    SELECT id INTO v_maq_id FROM public.vendor_categories WHERE slug = 'maquiagem';
    SELECT id INTO v_cab_id FROM public.vendor_categories WHERE slug = 'cabelo_penteados';

    INSERT INTO public.vendor_category_links (vendor_id, category_id)
    SELECT l.vendor_id, x.cat_id
      FROM public.vendor_category_links l
     CROSS JOIN (VALUES (v_maq_id), (v_cab_id)) AS x(cat_id)
     WHERE l.category_id = v_beleza_id AND x.cat_id IS NOT NULL
    ON CONFLICT (vendor_id, category_id) DO NOTHING;

    UPDATE public.vendor_categories
       SET parent_id   = (SELECT id FROM public.vendor_categories WHERE slug = 'beleza_estetica'),
           active      = false,
           sort_order  = 90,
           description = 'Categoria antiga (cabelo e maquiagem), substituída por Maquiagem e Cabelo e penteados.'
     WHERE id = v_beleza_id;
  END IF;

  -- 2e. Qualquer categoria restante sem pai (criada manualmente pelo admin e sem
  --     equivalente no seed) vira subcategoria de "Serviços complementares".
  SELECT string_agg(slug || ' (' || label || ')', ', ') INTO v_orphans
    FROM public.vendor_categories
   WHERE parent_id IS NULL AND slug NOT IN (SELECT slug FROM _vc_groups);

  IF v_orphans IS NOT NULL THEN
    RAISE NOTICE 'Categorias sem equivalente no novo catálogo movidas para "Serviços complementares": %', v_orphans;
    UPDATE public.vendor_categories
       SET parent_id = (SELECT id FROM public.vendor_categories WHERE slug = 'servicos_complementares'),
           sort_order = 50
     WHERE parent_id IS NULL AND slug NOT IN (SELECT slug FROM _vc_groups);
  END IF;

  -- 2f. Uma principal nunca deve ter vínculos. Só acontece se o admin tiver
  --     criado manualmente um slug igual ao de uma principal — aborta em vez de
  --     mexer em vínculos de fornecedor sem revisão humana.
  IF EXISTS (
    SELECT 1 FROM public.vendor_category_links l
      JOIN public.vendor_categories c ON c.id = l.category_id
     WHERE c.parent_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Há fornecedores vinculados a uma categoria principal — revisar manualmente antes de migrar.';
  END IF;
END $$;

-- ── 3. Integridade da hierarquia (no máximo 2 níveis) ──
CREATE OR REPLACE FUNCTION public.fn_vendor_categories_check_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.vendor_categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A categoria principal escolhida já é uma subcategoria.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.vendor_categories WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'Uma categoria principal com subcategorias não pode virar subcategoria.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.vendor_category_links WHERE category_id = NEW.id) THEN
    RAISE EXCEPTION 'Subcategoria com fornecedores vinculados não pode virar categoria principal.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_categories_check_hierarchy ON public.vendor_categories;
CREATE TRIGGER trg_vendor_categories_check_hierarchy
  BEFORE INSERT OR UPDATE OF parent_id ON public.vendor_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_vendor_categories_check_hierarchy();

-- ── 4. Vínculos novos só em subcategoria ativa com principal ativa ──
-- Só vale para INSERT/UPDATE: vínculos já existentes (inclusive com categorias
-- desativadas depois) continuam intactos.
CREATE OR REPLACE FUNCTION public.fn_vendor_category_links_check_leaf()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.vendor_categories c
      JOIN public.vendor_categories p ON p.id = c.parent_id
     WHERE c.id = NEW.category_id AND c.active AND p.active
  ) THEN
    RAISE EXCEPTION 'Selecione uma subcategoria ativa.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_category_links_check_leaf ON public.vendor_category_links;
CREATE TRIGGER trg_vendor_category_links_check_leaf
  BEFORE INSERT OR UPDATE OF category_id ON public.vendor_category_links
  FOR EACH ROW EXECUTE FUNCTION public.fn_vendor_category_links_check_leaf();

-- ── 5. Leitura pública: subcategoria de principal inativa também some ──
-- Função SECURITY DEFINER para não cair em recursão de RLS (a policy de
-- vendor_categories consultando vendor_categories).
CREATE OR REPLACE FUNCTION public.fn_vendor_category_parent_active(p_parent_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_parent_id IS NULL OR EXISTS (SELECT 1 FROM public.vendor_categories WHERE id = p_parent_id AND active);
$$;
REVOKE ALL ON FUNCTION public.fn_vendor_category_parent_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vendor_category_parent_active(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "anyone can read active vendor categories" ON public.vendor_categories;
CREATE POLICY "anyone can read active vendor categories"
  ON public.vendor_categories FOR SELECT
  USING (active = true AND public.fn_vendor_category_parent_active(parent_id));

-- ── 6. Reordenação atômica (admin) ──
-- Recebe os ids na ordem desejada (irmãos de um mesmo nível) e grava
-- sort_order = posição. RLS de admin vale normalmente (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.fn_admin_reorder_vendor_categories(p_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.fn_is_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador' USING ERRCODE = '42501';
  END IF;
  IF cardinality(p_ids) IS NULL OR cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Lista de categorias inválida' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))
        FROM public.vendor_categories WHERE id = ANY(p_ids)) > 1 THEN
    RAISE EXCEPTION 'Só é possível reordenar categorias do mesmo nível' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_categories c
     SET sort_order = o.pos - 1
    FROM unnest(p_ids) WITH ORDINALITY AS o(id, pos)
   WHERE c.id = o.id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_reorder_vendor_categories(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_reorder_vendor_categories(UUID[]) TO authenticated;
