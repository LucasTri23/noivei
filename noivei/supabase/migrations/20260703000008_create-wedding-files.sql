-- Tabela: wedding_files
-- RLS: wedding_id -> weddings.user_id = auth.uid(), mesmo padrão de gift_registry_items/guests
-- Upload de bytes é feito direto do browser pro Storage (bucket "wedding-files"); esta tabela
-- guarda só os metadados. Ver policies de storage.objects abaixo para a checagem de posse do arquivo.

-- =========================================================
-- wedding_files
-- =========================================================
CREATE TABLE wedding_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,  -- caminho no bucket, formato "{wedding_id}/{uuid}-{nome-sanitizado}"
  size_bytes   BIGINT NOT NULL,
  mime_type    TEXT,
  uploaded_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wedding_files_wedding_id ON wedding_files(wedding_id);

ALTER TABLE wedding_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own wedding files"
  ON wedding_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_files.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can insert own wedding files"
  ON wedding_files FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_files.wedding_id AND w.user_id = auth.uid()
  ));

-- Não usada pela API (arquivos não são editados, só criados/removidos), mantida por
-- consistência com o padrão de 4 policies do projeto.
CREATE POLICY "users can update own wedding files"
  ON wedding_files FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_files.wedding_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "users can delete own wedding files"
  ON wedding_files FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM weddings w WHERE w.id = wedding_files.wedding_id AND w.user_id = auth.uid()
  ));

-- =========================================================
-- Storage: bucket "wedding-files" (privado)
-- =========================================================
-- allowed_mime_types restringe a tipos que não fazem sentido ser executados/renderizados
-- inline pelo browser (nada de text/html, image/svg+xml, application/javascript etc.) —
-- é uma defesa em profundidade de upload de arquivo, mesmo com o bucket sendo privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wedding-files', 'wedding-files', false, 10485760, -- 10 MB por arquivo
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png', 'image/jpeg', 'image/webp', 'image/heic'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- As policies abaixo usam o primeiro segmento do path (storage.foldername(name)) como o
-- wedding_id do dono do arquivo. Essa é a convenção de path usada pelo client no upload
-- ("{wedding_id}/{uuid}-{nome-sanitizado}") — se ela mudar, as policies abaixo quebram.
CREATE POLICY "users can read own wedding files in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'wedding-files'
    AND EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "users can upload own wedding files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wedding-files'
    AND EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "users can delete own wedding files from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wedding-files'
    AND EXISTS (
      SELECT 1 FROM weddings w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.user_id = auth.uid()
    )
  );

-- =========================================================
-- plan_limits: cota de armazenamento (feature "max_storage_mb")
-- Valores batem com a tabela de comparação de planos (plan-selector.tsx)
-- =========================================================
INSERT INTO plan_limits (plan_id, feature, value) VALUES
  ('free',                 'max_storage_mb', 100),
  ('premium_monthly',      'max_storage_mb', 5120),
  ('premium_once',         'max_storage_mb', 5120),
  ('premium_plus_monthly', 'max_storage_mb', 20480),
  ('premium_plus_once',    'max_storage_mb', 20480);
