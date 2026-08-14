-- Fornecedores — Fase 1: bucket de Storage pras fotos de portfólio.
--
-- PRIVADO (não público) — decisão explícita do dono do produto, diferente do que
-- seria o padrão "óbvio" pra foto pública de vitrine. O fornecedor faz upload direto
-- do browser autenticado pro Storage (fornecedor TEM sessão real, diferente do
-- contribuidor anônimo do álbum) — mesmo desenho RLS de "wedding-files" (dono
-- autenticado sob RLS), não o desenho de "wedding-album-photos" (zero policy,
-- upload sempre proxied por rota com service role, pensado pra visitante anônimo
-- sem sessão nenhuma).
--
-- Visualização pública (marketplace/perfil) NÃO é resolvida aqui: vai passar por
-- uma rota de servidor (fase futura) que gera signed URL depois de checar
-- fn_vendor_is_publicly_visible() — por isso NENHUMA policy de SELECT pra
-- anon/authenticated-que-não-é-dono neste bucket, só o dono e o admin (via rota
-- futura com service role, que ignora RLS de qualquer forma).
--
-- 10 MB por foto: mesmo teto histórico usado por wedding-files pra imagens (o bump
-- pra 50 MB em 20260728000002 foi especificamente pra contratos/documentos grandes,
-- não se aplica aqui — este bucket só aceita imagem).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-portfolio', 'vendor-portfolio', false, 10485760, -- 10 MB por foto
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Convenção de path igual ao resto do projeto: "{vendor_id}/{uuid}-{nome-sanitizado}"
-- — o primeiro segmento (storage.foldername) é o vendor_id dono do arquivo.
CREATE POLICY "vendor can read own portfolio files in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-portfolio'
    AND fn_owns_vendor((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "vendor can upload own portfolio files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-portfolio'
    AND fn_owns_vendor((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Não usada pela API ainda (fotos são substituídas via remove+insert, não editadas
-- in-place), mantida por consistência com o padrão de 4 policies já usado em
-- wedding-files.
CREATE POLICY "vendor can update own portfolio files in storage"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-portfolio'
    AND fn_owns_vendor((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "vendor can delete own portfolio files from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-portfolio'
    AND fn_owns_vendor((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ATENÇÃO PRA QUEM IMPLEMENTAR A LIMPEZA DE STORAGE NO EXPURGO DE CONTA (LGPD):
-- src/app/api/cron/purge-accounts/route.ts mantém um array manual STORAGE_BUCKETS
-- que precisa incluir TODO bucket com arquivo, senão o arquivo fica órfão pra
-- sempre após a janela de retenção — isso já aconteceu uma vez de verdade
-- (wedding-album-photos ficou de fora até ser encontrado depois). 'vendor-portfolio'
-- NÃO foi adicionado lá nesta fase (a lógica de expurgo desta fase é só do lado
-- `weddings`, iterando por wedding_id — expurgo de CONTA DE FORNECEDOR precisa de
-- iteração própria por vendor_id, que é trabalho de uma fase futura de
-- billing/admin). Não esquecer antes do QA da Fase 9.
