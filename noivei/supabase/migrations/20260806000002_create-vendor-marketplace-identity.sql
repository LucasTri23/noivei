-- Fornecedores (marketplace de fornecedores) — Fase 1: identidade do fornecedor.
--
-- Camada de banco/domínio SOMENTE — sem rotas de API, sem UI, sem integração de
-- cobrança de verdade ainda (isso vem nas fases seguintes). Este arquivo cobre a
-- "identidade" do fornecedor: quem é (vendor_profiles), em quais categorias atua
-- (vendor_categories / vendor_category_links) e seu portfólio de fotos
-- (vendor_portfolio_items) — mais o log de auditoria de ações do admin sobre um
-- fornecedor (vendor_admin_actions).
--
-- DECISÃO DE IDENTIDADE (aprovada pelo dono do produto): `profiles.role` continua
-- intocado — é usado por exatamente dois gates de código
-- (src/lib/auth/require-admin.ts, src/app/(admin)/admin/layout.tsx) e ~15 policies
-- RLS via fn_is_admin(). "Ser fornecedor" é uma capacidade SEPARADA: a EXISTÊNCIA de
-- uma linha em vendor_profiles é o sinal. Uma conta pode ter uma linha em `weddings`
-- (ser casal) E uma linha em vendor_profiles (ser fornecedor) ao mesmo tempo — conta
-- híbrida, de propósito sem constraint impedindo isso.
--
-- Rotas que este schema vai sustentar (rotas/páginas são fases posteriores, só
-- nomeando as coisas de forma consistente desde já):
--   /fornecedores        — marketplace autenticado (casal navega fornecedores)
--   /para-fornecedores   — landing pública
--   /profissionais/[slug] — perfil público do fornecedor (path DIFERENTE de
--                           /fornecedores de propósito, evita ambiguidade de
--                           middleware entre marketplace autenticado e perfil público)
--   /fornecedor/**        — dashboard autenticado do PRÓPRIO fornecedor, novo grupo
--                           de rotas (vendor) — ainda não existe, fase 2/3.

-- =========================================================
-- vendor_profiles
-- =========================================================
CREATE TABLE vendor_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name      TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE, -- usado em /profissionais/[slug]; sanitização é responsabilidade da API (fase futura)
  cnpj               TEXT,
  phone              TEXT,
  whatsapp           TEXT,
  show_whatsapp      BOOLEAN NOT NULL DEFAULT true,
  instagram          TEXT,
  website             TEXT,
  city               TEXT,
  state              TEXT,
  description        TEXT,
  price_range        TEXT, -- texto livre ('$'/'$$'/'$$$' ou faixa em texto) — sem CHECK de propósito, decisão de UI fica pra fase futura
  cover_storage_path TEXT,
  logo_storage_path  TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'suspended', 'rejected')),
  featured           BOOLEAN NOT NULL DEFAULT false,
  rejection_reason   TEXT, -- admin-facing, setado no reject/suspend
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_profiles_status ON vendor_profiles(status);
-- slug e user_id já têm índice implícito via UNIQUE, sem índice redundante.

CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- SECURITY DEFINER + SET search_path fixo, mesmo padrão de fn_is_wedding_member /
-- fn_has_module_access / fn_is_admin — evita repetir o EXISTS em toda policy nova
-- (Storage e tabelas filhas) e evita qualquer risco de recursão de policy.
CREATE OR REPLACE FUNCTION fn_owns_vendor(p_vendor_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vendor_profiles
    WHERE id = p_vendor_id AND user_id = p_user_id
  );
$$;

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor can read own profile"
  ON vendor_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins can read all vendor profiles"
  ON vendor_profiles FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Leitura PÚBLICA (anon/authenticated que não é dono nem admin) é adicionada na
-- migration de billing (20260806000003), depois que fn_vendor_is_publicly_visible()
-- existir — essa function depende de vendor_subscriptions, que ainda não existe
-- neste arquivo. Ver "public marketplace read policies" naquele arquivo.

-- Fornecedor cria a própria linha (fluxo "virar fornecedor", rota de API de fase
-- futura). Diferente da policy de UPDATE abaixo, aqui DÁ pra restringir
-- status/featured pela RLS sem nenhum custo de expressividade — é uma linha NOVA,
-- não uma edição de linha existente com nuances de "outros campos continuam livres",
-- então não existe motivo legítimo pra um fornecedor nascer diferente de
-- status='draft'/featured=false. Defesa em profundidade real (não só decorativa).
CREATE POLICY "vendor can create own profile"
  ON vendor_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND featured = false);

-- ATENÇÃO — RESTRIÇÃO DE COLUNA NÃO EXISTE EM RLS, SÓ NO CONTRATO DA API:
-- RLS é só de LINHA. Esta policy libera o fornecedor dono a atualizar A PRÓPRIA
-- linha inteira, sem nenhuma restrição de coluna — não há como o Postgres RLS negar
-- update de `status`/`featured`/`rejection_reason` mas permitir o resto na MESMA
-- linha. A defesa real contra o fornecedor se auto-aprovar (status='active'), se
-- auto-destacar (featured=true) ou apagar o motivo de rejeição é o endpoint de
-- autoedição do fornecedor (fase futura) nunca incluir esses três campos no schema
-- Zod de update — ver teste em src/tests/rls/vendor-profiles.test.ts que
-- demonstra exatamente isso (RLS permite a update; API é quem tem que proteger).
CREATE POLICY "vendor can update own profile"
  ON vendor_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins can update any vendor profile"
  ON vendor_profiles FOR UPDATE
  USING (fn_is_admin(auth.uid()));

-- Sem policy de DELETE de propósito — mesmo padrão de `weddings` (soft delete via
-- UPDATE deleted_at, nunca hard delete pelo client).

-- =========================================================
-- vendor_categories — taxonomia. Seed reproduz EXATAMENTE o vocabulário já usado no
-- questionário de onboarding (FORNECEDORES_OPTS em
-- src/components/checklist/questionnaire-wizard.tsx) — mesmos values/labels, pra
-- esta tabela poder virar a fonte única de verdade no futuro sem precisar remapear
-- nada. O questionário NÃO foi refatorado pra ler daqui nesta fase (fora de escopo,
-- ver relatório final) — as duas listas coexistem até uma fase futura unificar.
-- =========================================================
CREATE TABLE vendor_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;

-- Taxonomia não é dado sensível — leitura aberta pra ativas, mesmo padrão de
-- "anyone can read active plans". Admin enxerga tudo (inclusive inativas) e escreve
-- via a policy FOR ALL abaixo — policies permissivas do mesmo comando (SELECT) se
-- combinam com OR, então admin não perde nada por causa do filtro active=true.
CREATE POLICY "anyone can read active vendor categories"
  ON vendor_categories FOR SELECT
  USING (active = true);

CREATE POLICY "admins can manage vendor categories"
  ON vendor_categories FOR ALL
  USING (fn_is_admin(auth.uid()))
  WITH CHECK (fn_is_admin(auth.uid()));

INSERT INTO vendor_categories (slug, label, sort_order) VALUES
  ('buffet',                'Buffet',                        0),
  ('fotografia',            'Fotografia',                     1),
  ('filmagem',              'Filmagem',                       2),
  ('doces',                 'Doces e bem-casados',            3),
  ('bolo',                  'Bolo',                           4),
  ('flores_decoracao',      'Flores e decoração',             5),
  ('carro_cerimonia',       'Carro da cerimônia',              6),
  ('cabine_fotos',          'Cabine de fotos',                7),
  ('iluminacao_cenica',     'Iluminação cênica',              8),
  ('som_estrutura',         'Som e estrutura',                9),
  ('beleza',                'Beleza (cabelo e maquiagem)',    10),
  ('transporte_convidados', 'Transporte de convidados',       11);

-- =========================================================
-- vendor_category_links — N:N entre fornecedor e categoria.
-- ON DELETE RESTRICT em category_id: o caminho esperado pro admin "desativar" uma
-- categoria é active=false (UPDATE), não apagar a linha — um hard delete de uma
-- categoria ainda em uso por algum fornecedor deve falhar alto, não apagar em
-- cascata os vínculos silenciosamente.
-- =========================================================
CREATE TABLE vendor_category_links (
  vendor_id   UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES vendor_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (vendor_id, category_id)
);

CREATE INDEX idx_vendor_category_links_category_id ON vendor_category_links(category_id);
-- vendor_id já tem índice implícito (primeira coluna da PK composta).

ALTER TABLE vendor_category_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor can read own category links"
  ON vendor_category_links FOR SELECT
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "admins can read all category links"
  ON vendor_category_links FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Leitura pública (marketplace/perfil) é adicionada em 20260806000003, mesmo motivo
-- do adiamento em vendor_profiles acima.

CREATE POLICY "vendor can manage own category links"
  ON vendor_category_links FOR INSERT
  WITH CHECK (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "vendor can delete own category links"
  ON vendor_category_links FOR DELETE
  USING (fn_owns_vendor(vendor_id, auth.uid()));

-- =========================================================
-- vendor_portfolio_items — fotos de portfólio (metadados; bytes ficam no bucket
-- Storage "vendor-portfolio", ver migration 20260806000005).
-- =========================================================
CREATE TABLE vendor_portfolio_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_portfolio_items_vendor_id ON vendor_portfolio_items(vendor_id);

ALTER TABLE vendor_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor can read own portfolio items"
  ON vendor_portfolio_items FOR SELECT
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "admins can read all portfolio items"
  ON vendor_portfolio_items FOR SELECT
  USING (fn_is_admin(auth.uid()));

-- Leitura pública é adicionada em 20260806000003, mesmo motivo do adiamento acima.

CREATE POLICY "vendor can insert own portfolio items"
  ON vendor_portfolio_items FOR INSERT
  WITH CHECK (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "vendor can update own portfolio items"
  ON vendor_portfolio_items FOR UPDATE
  USING (fn_owns_vendor(vendor_id, auth.uid()));

CREATE POLICY "vendor can delete own portfolio items"
  ON vendor_portfolio_items FOR DELETE
  USING (fn_owns_vendor(vendor_id, auth.uid()));

-- =========================================================
-- vendor_admin_actions — auditoria de ações do admin sobre um fornecedor
-- (aprovar/rejeitar/suspender/reativar/destacar...). Só admin lê/escreve.
-- =========================================================
CREATE TABLE vendor_admin_actions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES auth.users(id),
  vendor_id  UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  action     TEXT NOT NULL, -- 'approved' | 'rejected' | 'suspended' | 'reactivated' | 'featured' | 'unfeatured' etc.
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_admin_actions_vendor_id ON vendor_admin_actions(vendor_id);
CREATE INDEX idx_vendor_admin_actions_admin_id  ON vendor_admin_actions(admin_id);

ALTER TABLE vendor_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read vendor admin actions"
  ON vendor_admin_actions FOR SELECT
  USING (fn_is_admin(auth.uid()));

CREATE POLICY "admins can insert vendor admin actions"
  ON vendor_admin_actions FOR INSERT
  WITH CHECK (fn_is_admin(auth.uid()) AND admin_id = auth.uid());
