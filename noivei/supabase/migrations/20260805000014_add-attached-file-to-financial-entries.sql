-- Permite anexar um arquivo da Central de Arquivos (wedding_files) a um lançamento
-- financeiro (ex.: orçamento/recibo do fornecedor). Nullable: a imensa maioria dos
-- lançamentos não tem anexo. ON DELETE SET NULL: se o arquivo for apagado depois na
-- Central de Arquivos, o lançamento financeiro continua existindo, só perde a
-- referência — nunca o contrário (apagar o lançamento não mexe no arquivo).
ALTER TABLE financial_entries
  ADD COLUMN attached_file_id UUID REFERENCES wedding_files(id) ON DELETE SET NULL;
