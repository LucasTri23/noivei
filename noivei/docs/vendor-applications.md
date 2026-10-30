# Solicitações de fornecedores

Entrada pública: /para-fornecedores. O botão "Sou fornecedor" no login leva até ela.
O cadastro cria uma conta e um rascunho de solicitação, sem exigir um casamento.
CNPJ e ao menos uma categoria são obrigatórios para enviar para análise; fotos são opcionais.
A validação de CNPJ verifica preenchimento e formato (normalizado, com ou sem máscara), sem consultar a Receita Federal.

O admin acessa /admin/fornecedores, que abre filtrado por "Em análise". Pode escolher outros status no filtro.
No detalhe, vê o CNPJ e pode aprovar ou rejeitar, informando um motivo. O fornecedor rejeitado pode corrigir e reenviar.
Antes da aprovação ficam disponíveis cadastro, edição dos dados e acompanhamento do status. Assinatura e mensagens ficam bloqueadas.
Aprovação libera o painel; visibilidade para casais também exige assinatura ativa e válida.

## Ativação

1. Aplicar a migration 20261030000001_vendor-applications-and-email-outbox.sql depois das migrations existentes.
2. Configurar EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, EMAIL_FROM.
3. Configurar VENDOR_ADMIN_EMAIL com a caixa que receberá os avisos administrativos, NEXT_PUBLIC_APP_URL com a URL oficial e CRON_SECRET para o cron.
4. Publicar o código e o vercel.json, incluindo /api/cron/vendor-emails.

A mudança de status grava duas entregas na mesma transação, uma para o admin e outra para o e-mail autenticado do fornecedor.
O envio é tentado logo após a solicitação/decisão. Falhas ficam pendentes para o cron diário (13h UTC) ou uma chamada autenticada ao mesmo endpoint.
O cron processa até 20 entregas por execução; se o volume crescer, aumentar a frequência de execução.
A fila usa lease de 10 minutos contra concorrência. Se o processo morrer após enviar e antes de registrar o sucesso, pode haver reenvio.
Sem SMTP/configuração, as entregas não são marcadas como enviadas.
Cadastros antigos sem CNPJ são preservados na aplicação da migration, mas precisam informar o documento antes da próxima gravação.

Verificação em homologação: enviar solicitação, conferir os dois e-mails e a fila do admin; rejeitar, conferir o motivo e reenviar; aprovar e conferir liberação da assinatura. Não executar testes de integração contra produção.

## Cadastro feito pelo administrador

No painel /admin/fornecedores, usar "Adicionar fornecedor". Nome, e-mail, CNPJ e ao menos uma categoria ativa são obrigatórios.
O cadastro do admin já é aprovado, com auditoria. Não cria assinatura nem concede destaque automaticamente.
Se o e-mail já tem conta de fornecedor, vincula o perfil sem alterar a senha. E-mails de contas de noivos são recusados; os dois tipos precisam de e-mails distintos. Se não tem, o Supabase Auth envia convite para definir senha em /reset-password?next=/fornecedor.
Configurar também o SMTP de autenticação no Supabase e permitir essa URL de redirecionamento em Authentication > URL Configuration.
Aplicar a migration 20261030000002_admin-create-vendors.sql após a 20261030000001.
Perfil, categorias, aprovação e auditoria são salvos juntos. O convite de autenticação é externo à transação: se falhar a criação do perfil depois do convite, cadastrar novamente com o mesmo e-mail; a conta convidada é reutilizada.

Separação dos tipos e migração de contas existentes: [account-types.md](account-types.md).
