-- Adiciona categorização à Central de Arquivos: hoje todo arquivo cai numa lista só,
-- sem distinguir contratos assinados de documentos gerais. `category` separa os dois
-- num filtro simples na UI (aba "Contratos" vs "Geral"), sem afetar cota de
-- armazenamento (checkStorageLimit já soma wedding_files inteiro, categoria não muda isso)
-- nem a lógica de upload/exclusão existente.
-- DEFAULT 'geral' garante que todo arquivo já existente (enviado antes desta migration)
-- continua aparecendo normalmente na aba "Geral", sem precisar de backfill manual.
ALTER TABLE wedding_files
  ADD COLUMN category TEXT NOT NULL DEFAULT 'geral'
  CHECK (category IN ('geral', 'contrato'));
