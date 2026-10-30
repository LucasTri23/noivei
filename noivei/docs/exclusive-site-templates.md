# Novos estilos do site do casal

Três modelos exclusivos dos planos Exclusivo mensal e pagamento único (premium_plus_monthly / premium_plus_once):

- Editorial: composição de revista, tipografia grande e fotografia em destaque.
- Jardim Romântico: molduras em arco, ramos desenhados em SVG e papel claro.
- Convite Selado: capa com duas abas na cor do casamento, cordão e selo dourados, abertura animada e site interno com linguagem de papelaria.

Todos usam a cor primária do casamento: tons claro/escuro e fundos derivam das variáveis --wedding-color. O dourado do selo é um detalhe adicional; a capa não é uma cor fixa.
Conteúdo, fotos, recorte da capa, presentes, pagamentos, mapa, mural e instruções de RSVP usam os mesmos dados dos modelos existentes.
O RSVP continua pelo link pessoal de cada convidado, sem expor a lista de convidados no site público.
A abertura funciona por teclado e respeita prefers-reduced-motion. O foco passa para o conteúdo depois da abertura.

Aplicar a migration 20261030000003_exclusive-wedding-site-templates.sql antes de publicar o código.
Os modelos ficam ocultos no editor dos planos inferiores. A API e um trigger no banco também impedem selecioná-los.
Após downgrade, a leitura pública renderiza Clássico sem apagar o modelo salvo; ao voltar ao Exclusivo, ele volta a ser usado.
Não foram alteradas as regras dos modelos Clássico e Portfólio.

Referências de pesquisa (interpretação visual própria, sem copiar código ou imagens):
- https://studioamorae.com/journal/best-editorial-wedding-website-examples
- https://agapewedding.com/en/templates
- https://birevet.com/en/invitation-themes/envelope
- Foto do convite enviada pelo usuário: capa, cordão diagonal e selo dourado.


## Editor por estilo

O seletor adapta os campos de texto da capa assim que o modelo é escolhido. Salvar capa confirma a troca para as demais abas. As abas História e Galeria seguem o modelo salvo.

| Estilo | Galeria | Fotos adicionais | Campos específicos |
| --- | --- | --- | --- |
| Clássico | Sem teto de estilo, sujeito ao armazenamento | 1 capa; 8 primeiras fotos na história em polaroids | História e mensagem tradicionais; sem foto de história separada |
| Portfólio | 14 | 1 capa e 1 foto de história | Sobre os noivos, destaque fotográfico e grade 4 + 5 + 5 |
| Editorial | 8 | 1 capa e 1 retrato de história | Frase de abertura, títulos da história e da galeria |
| Jardim Romântico | 12 | 1 capa e 1 foto de história | Boas-vindas ao jardim, títulos da história e das memórias |
| Convite Selado | 6 | 1 capa e 1 foto da mensagem | Texto do convite, dedicatória no envelope, instrução de abertura e mensagem aos convidados |

Dados do casal, data, local, cerimônia, recepção, traje, presentes e RSVP continuam compartilhados. A cor primária do casamento permanece em todos os estilos.

A API valida os campos e novas seleções de galeria pelo modelo salvo mesmo quando o PATCH não contém template. Ao trocar para um modelo menor, fotos e textos anteriores são preservados; a página pública mostra as primeiras fotos até o limite. Na aba Galeria, remover da seleção e salvar permite reduzir a quantidade, ou é possível voltar ao modelo anterior. Campos exclusivos de outro estilo ficam ocultos e preservados. O mural de fotos dos convidados continua separado da galeria do casal.

Não há migration adicional para este ajuste: os textos novos usam site_config.content.
