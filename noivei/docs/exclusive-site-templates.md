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
