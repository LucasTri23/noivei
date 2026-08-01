-- Sobe o limite por arquivo de 10 MB para 50 MB (contratos e afins costumam passar de
-- 10 MB). Mantém intactas as duas defesas já existentes: a whitelist de
-- allowed_mime_types (nada executável/renderizável inline pelo browser) e a cota total
-- de armazenamento por plano (plan_limits.max_storage_mb) — só o teto por arquivo
-- individual muda, não a proteção contra abuso de espaço.
UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50 MB
WHERE id = 'wedding-files';
