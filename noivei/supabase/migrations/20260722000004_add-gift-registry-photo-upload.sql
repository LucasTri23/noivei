-- Permite enviar a foto do item da lista de presentes direto do dispositivo (em vez de
-- só colar um link de imagem externa) — mesmo padrão de wedding_gallery_photos: os bytes
-- sobem direto do browser pro Storage, e a tabela guarda o caminho + tamanho real.
--
-- image_storage_path é preenchido só quando a foto foi enviada do dispositivo; nesse
-- caso a API recalcula image_url a partir dele em toda leitura (nunca confia num
-- image_url gravado, igual toPublicUrl() de gallery-photos) — permite trocar a foto
-- sem deixar um link velho gravado por engano. Quando o casal só colou uma URL externa,
-- image_storage_path fica NULL e image_url é usado como está.
--
-- image_size_bytes soma na cota de armazenamento do plano (checkStorageLimit), no mesmo
-- pool de wedding_files + wedding_gallery_photos — sem isso, dava pra furar a cota
-- subindo fotos de presente sem limite.

ALTER TABLE gift_registry_items
  ADD COLUMN image_storage_path TEXT,
  ADD COLUMN image_size_bytes   INTEGER;

-- =========================================================
-- Storage: bucket "wedding-gift-photos" (público — aparece no site público)
-- =========================================================
-- allowed_mime_types restringe a tipos de imagem de verdade — nunca aceitar qualquer
-- MIME (CWE-434).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wedding-gift-photos', 'wedding-gift-photos', true, 8388608, -- 8 MB por foto
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Path: "{wedding_id}/{uuid}-{nome-sanitizado}" — mesma convenção de wedding-photos.
-- Bucket público: SELECT liberado geral, é assim que getPublicUrl funciona sem RLS
-- bloquear o carregamento da imagem em /[slug] (visitante não autenticado).
CREATE POLICY "anyone can view wedding gift photos in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wedding-gift-photos');

CREATE POLICY "members can upload wedding gift photos to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wedding-gift-photos'
    AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'presentes')
  );

CREATE POLICY "members can delete wedding gift photos from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wedding-gift-photos'
    AND fn_has_module_access((storage.foldername(name))[1]::uuid, auth.uid(), 'presentes')
  );
