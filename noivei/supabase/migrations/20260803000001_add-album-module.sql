-- Módulo "Álbum de fotos" (mural de fotos via QR code): qualquer convidado pode
-- escanear um QR/link público, se "cadastrar" com nome/relação/telefone (sem
-- conta real, nunca passa por auth.signUp) e enviar fotos tiradas no evento.
-- É a superfície pública e anônima de maior risco do app — todo acesso de
-- escrita/leitura de arquivo passa por rotas com service role (nunca RLS de
-- anon/authenticated direto pro Storage), com rate limit por IP e por
-- casamento/token (ver checkRateLimit nas rotas de /api/v1/album/[token]/*).

-- =========================================================
-- 'album' como módulo restringível — mesmo padrão dinâmico da migration
-- 20260729000001 (plan_module_access): descobre o nome real da CHECK constraint
-- em vez de supor, porque esse nome é gerado automaticamente pelo Postgres.
-- =========================================================
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'plan_module_access'
    AND con.contype = 'c'
    AND att.attname = 'module';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE plan_module_access DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE plan_module_access ADD CONSTRAINT plan_module_access_module_check
    CHECK (module IN (
      'checklist', 'convidados', 'financeiro', 'mesas',
      'site', 'arquivos', 'presentes', 'padrinhos', 'checkin', 'album'
    ));
END $$;

-- Seed: só o plano ATIVO mais caro (price_brl) ganha o módulo liberado — mesmo
-- critério prático usado no check-in ("plano com usuários ilimitados", que na
-- prática nenhum plano tem hoje; free=1, premium=5, premium_plus=10 em
-- plan_limits.max_users). Todos os demais planos (Gratuito incluso) ficam com
-- album = false: é opt-in manual do admin em /admin/planos/modulos.
INSERT INTO plan_module_access (plan_id, module, enabled)
SELECT
  p.id,
  'album',
  COALESCE(p.price_brl = (SELECT MAX(price_brl) FROM plans WHERE is_active = true), false)
FROM plans p
ON CONFLICT (plan_id, module) DO NOTHING;

-- Todo plano NOVO criado depois de hoje começa com album = false — diferente
-- de mesas/site/arquivos/presentes (que herdam price_brl > 0), o álbum nunca é
-- liberado automaticamente, nem para planos pagos: é sempre opt-in manual.
-- Reescreve a function inteira (já redefinida em 20260801000001 para incluir
-- 'checkin') — preserva o mesmo tratamento pro check-in, que também é opt-in.
CREATE OR REPLACE FUNCTION fn_seed_plan_module_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO plan_module_access (plan_id, module, enabled)
  SELECT
    NEW.id,
    m.module,
    CASE
      WHEN m.module IN ('checkin', 'album') THEN false
      WHEN m.module IN ('mesas', 'site', 'arquivos', 'presentes') THEN NEW.price_brl > 0
      ELSE true
    END
  FROM (
    VALUES ('checklist'), ('convidados'), ('financeiro'), ('mesas'),
           ('site'), ('arquivos'), ('presentes'), ('padrinhos'), ('checkin'), ('album')
  ) AS m(module)
  ON CONFLICT (plan_id, module) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================
-- weddings.album_token — identificador estável e imprevisível do link/QR
-- público do álbum. Não reaproveita site_config.slug de propósito: nem todo
-- casamento tem site publicado, e este recurso não pode depender disso.
-- =========================================================
ALTER TABLE weddings
  ADD COLUMN album_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- =========================================================
-- album_contributors — quem se "cadastrou" no mural. Não é uma conta de
-- verdade (nunca passa por auth.signUp): é só uma linha nomeada, usada pra
-- creditar as fotos enviadas ao nome/relação informados.
-- =========================================================
CREATE TABLE album_contributors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_album_contributors_wedding_id ON album_contributors(wedding_id);

ALTER TABLE album_contributors ENABLE ROW LEVEL SECURITY;

-- De propósito, SEM policy de INSERT/SELECT pra anon/authenticated: o cadastro
-- público (POST /api/v1/album/[token]/register) sempre escreve via service
-- role, que ignora RLS — não existe sessão alguma pro visitante anônimo. A
-- única policy daqui é pro TIME DO CASAL ler os nomes na tela de gestão
-- autenticada, mesmo critério de acesso a módulo já usado no resto do app.
CREATE POLICY "wedding team can read album contributors"
  ON album_contributors FOR SELECT
  USING (fn_has_module_access(wedding_id, auth.uid(), 'album'));

-- =========================================================
-- album_photos — uma linha por foto enviada por um contribuidor.
-- =========================================================
CREATE TABLE album_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id     UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES album_contributors(id) ON DELETE CASCADE,
  storage_path   TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  mime_type      TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_album_photos_wedding_id ON album_photos(wedding_id);

ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;

-- De propósito, SEM policy de INSERT pra anon/authenticated: o upload público
-- (POST /api/v1/album/[token]/photos) sempre passa por service role. SELECT e
-- DELETE ficam liberados pro time do casal (moderação/curadoria na tela
-- autenticada), mesmo critério de fn_has_module_access do resto do app.
CREATE POLICY "wedding team can read album photos"
  ON album_photos FOR SELECT
  USING (fn_has_module_access(wedding_id, auth.uid(), 'album'));

CREATE POLICY "wedding team can delete album photos"
  ON album_photos FOR DELETE
  USING (fn_has_module_access(wedding_id, auth.uid(), 'album'));

-- =========================================================
-- Storage: bucket "wedding-album-photos" (PRIVADO)
-- =========================================================
-- 4 MB por foto: diferente de wedding-files/wedding-gift-photos (upload direto
-- do browser autenticado pro Storage, sob RLS), aqui não existe sessão nenhuma
-- — o visitante é anônimo, então o upload é sempre PROXIED pela nossa própria
-- Route Handler com service role (ver POST /api/v1/album/[token]/photos).
-- Serverless Functions da Vercel têm um teto de corpo de requisição em torno
-- de 4.5 MB; 4 MB deixa margem de segurança pro multipart/form-data inteiro
-- (bytes da foto + overhead do form) não estourar esse teto.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wedding-album-photos', 'wedding-album-photos', false, 4194304, -- 4 MB por foto
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- De propósito, NENHUMA policy de storage.objects pra anon/authenticated neste
-- bucket (nem SELECT, nem INSERT/DELETE) — toda leitura (grid de curadoria do
-- casal) e toda escrita (upload do convidado, remoção pelo casal) passam por
-- rota com service role, que ignora RLS. Mais restritivo que wedding-files
-- (que libera SELECT pro dono autenticado): aqui não há "dono" confiável no
-- upload (é anônimo), então nem o lado autenticado do casal lê o objeto
-- direto — sempre via signed URL de 60s gerada pela nossa API.
