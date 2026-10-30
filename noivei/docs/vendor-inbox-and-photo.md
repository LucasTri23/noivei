# Foto e caixa de entrada de fornecedores

O fornecedor envia ou remove sua foto/logotipo em Meu perfil; também pode enviar na revisão do cadastro.
Aceita JPG, PNG e WEBP de até 2 MB. O servidor verifica a assinatura do arquivo e grava somente no perfil autenticado.
Usa o campo logo_storage_path e o bucket privado vendor-portfolio já existentes, sem migration adicional.
A foto aparece nos cards, perfil público e conversas. O endpoint de exibição aplica RLS e valida o prefixo do path antes de gerar URL assinada de cinco minutos. Falhas exibem a inicial da empresa.

Em Fornecedores, as abas Buscar fornecedores e Conversas dão acesso à caixa de entrada.
No computador, lista e chat ficam lado a lado; no celular, abrir um contato mostra a conversa e permite voltar à lista.
Busca por nome, filtro de não lidas, última mensagem, horário e contagem de não lidas usam a RPC existente.
Casal e fornecedor usam a mesma caixa de entrada, com filtros separados por papel.

A lista atualiza a cada 15 segundos e pelo Realtime quando chegam mensagens. Ao voltar à aba, também refaz a consulta.
Há avisos dentro do site e opção Ativar notificações no navegador. A permissão só é solicitada após clique.
Avisos não incluem o conteúdo da mensagem, não repetem o histórico inicial e não alertam mensagens próprias ou já lidas.
Notificações do sistema são destinadas aos navegadores desktop compatíveis, em HTTPS, com o site aberto (inclusive em outra aba). Navegadores móveis podem não suportar o construtor Notification; os avisos dentro do site permanecem disponíveis. Não há push com o navegador fechado.

Pré-requisitos do chat: migrations de Realtime e a correção 20261030000004_fix-vendor-conversation-insert-returning.sql aplicadas.
