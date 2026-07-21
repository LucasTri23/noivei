-- Tabela: wedding_gallery_photos
-- Guarda os metadados das fotos da Galeria do site público que o casal envia direto do
-- computador (em vez de colar uma URL externa). O upload de bytes é feito direto do
-- browser pro Storage (bucket "wedding-photos"); esta tabela só guarda os metadados —
-- mesmo padrão de wedding_files, mas o bucket aqui é PÚBLICO (fotos aparecem em /[slug]
-- sem autenticação), então o modelo de RLS de storage.objects muda: leitura é liberada
-- geral, só escrita/exclusão ficam restritas ao dono do casamento.
--
-- A cota de armazenamento (plan_limits.max_storage_mb) é compartilhada com a Central de
-- Arquivos — checkStorageLimit soma size_bytes desta tabela + wedding_files, não é um
-- pool separado. Por isso não há novo seed de plan_limits aqui.

-- =========================================================
-- wedding_gallery_photos
-- =========================================================
CREATE TABLE wedding_gallery_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE, -- caminho no bucket, formato "{wedding_id}/{uuid}-{nome-sanitizado}"
  size_bytes   BIGINT NOT NULL,
  mime_type    TEXT,
  uploaded_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wedding_gallery_photos_wedding_id ON wedding_gallery_photos(wedding_id);

ALTER TABLE wedding_gallery_photos ENABLE ROW LEVEL SECURITY;

-- O bucket de Storage é público (ver abaixo), mas a TABELA de metadados (com
-- uploaded_by/created_at) continua restrita ao dono — só o objeto binário precisa ser
-- acessível sem autenticação para renderizar o site público.
CREATE POLICY "users can read own wedding gallery photos"
  ON wedding_gallery_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_gallery_photos.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own wedding gallery photos"
  ON wedding_gallery_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_gallery_photos.wedding_id AND w.user_id = auth.uid()
  ));

-- Não usada pela API (fotos não são editadas, só criadas/removidas), mantida por
-- consistência com o padrão de 4 policies do projeto.
CREATE POLICY "users can update own wedding gallery photos"
  ON wedding_gallery_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_gallery_photos.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own wedding gallery photos"
  ON wedding_gallery_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_gallery_photos.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- Storage: bucket "wedding-photos" (público)
-- =========================================================
-- allowed_mime_types restringe a tipos de imagem de verdade — nunca aceitar qualquer
-- MIME (CWE-434). Nada de text/html, image/svg+xml (pode carregar script) etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wedding-photos', 'wedding-photos', true, 8388608, -- 8 MB por foto
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- As policies abaixo usam o primeiro segmento do path (storage.foldername(name)) como o
-- wedding_id do dono da foto. Essa é a convenção de path usada pelo client no upload
-- ("{wedding_id}/{uuid}-{nome-sanitizado}") — se ela mudar, as policies abaixo quebram.

-- Bucket público: SELECT liberado geral, é assim que getPublicUrl funciona sem RLS
-- bloquear o carregamento da imagem em /[slug] (visitante não autenticado).
CREATE POLICY "anyone can view wedding gallery photos in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wedding-photos');

CREATE POLICY "users can upload own wedding gallery photos to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wedding-photos'
    AND EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "users can delete own wedding gallery photos from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wedding-photos'
    AND EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.user_id = auth.uid()
    )
  );
