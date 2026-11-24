# Homologação — Personalização do site do casal

Monograma em imagem, fontes, cores, ordem e visibilidade das seções, perguntas
frequentes e hospedagem. Complementa `homologacao-nossa-historia.md`.

**Pré-requisito:** migrations aplicadas no banco de homologação, nesta ordem:
`20261118000001`, `20261118000002`, `20261123000002` (se ainda não estiver) e
`20261124000001_site-customization.sql`.

**Estilos (7):** Clássico, Fotográfico, Portfólio, Editorial, Jardim Romântico,
Convite Selado e Envelopado.
**Larguras:** celular 375 px (e 320 px), tablet 768/1024 px, desktop 1280/1920 px.

**Contas de teste:** um casamento no plano **Gratuito**, um no **Ideal** e um no
**Exclusivo** (os dois estilos com envelope só existem no Exclusivo).

---

## 1. Compatibilidade (primeiro, com um site já publicado)

- [ ] Sem mexer em nada, os 7 estilos aparecem idênticos aos de produção: fontes, cores, ordem das seções e menu.
- [ ] Convite Selado e Envelopado: envelope, selo dourado e animação iguais aos de produção.
- [ ] Abrir as abas novas (Aparência, Seções, Dúvidas & hospedagem) e sair sem alterar: a barra "alterações não salvas" não aparece.

## 2. Monograma em imagem (Ideal e Exclusivo)

- [ ] Capa → Estilo do site → "Usar uma imagem": PNG transparente, JPG e WEBP funcionam; a imagem aparece na pré-visualização redonda.
- [ ] SVG, HEIC e PDF são recusados com mensagem clara.
- [ ] Imagem grande (ex.: 4000 px) é reduzida antes do envio (aba Rede: arquivo final pequeno, ≤ 600 px).
- [ ] Salvar → a imagem aparece:
  - [ ] no selo do Convite Selado e do Envelopado, dentro do círculo, sem cortar;
  - [ ] no topo dos estilos Editorial, Jardim e Fotográfico;
  - [ ] na capa do Clássico;
  - [ ] na barra de navegação do Portfólio.
- [ ] Leitor de tela: a imagem é lida como "Monograma A & J" (texto do monograma).
- [ ] "Remover imagem" e salvar: o texto volta e a barra de armazenamento diminui.
- [ ] Trocar a imagem duas vezes e salvar: só a última fica no armazenamento.
- [ ] A imagem não aparece na galeria e não conta no limite de fotos do estilo.
- [ ] Gratuito: o campo de monograma não aparece.

## 3. Aparência

**Fontes (Ideal e Exclusivo)**
- [ ] Os 6 pares aparecem com prévia "Ana & João" na própria fonte.
- [ ] Escolher cada par e salvar: títulos e textos mudam nos 7 estilos; acentos (ã, ç, é) aparecem corretos.
- [ ] "Padrão do estilo" volta às fontes originais.
- [ ] Gratuito: pares desabilitados com aviso do plano Ideal.

**Cor de destaque (todos os planos)**
- [ ] Trocar a cor muda botões, títulos de destaque e detalhes do site, mas não a cor do casamento no app.
- [ ] Uma cor muito clara com fundo claro mostra o aviso de legibilidade, e o salvamento é recusado.
- [ ] "Usar a cor do casamento" desfaz.

**Fundo (Ideal e Exclusivo)**
- [ ] Claro, Creme e Escuro nos 7 estilos: textos legíveis, cartões, botões e faixas sem texto "sumindo".
- [ ] No Escuro, conferir em cada estilo:
  - [ ] botão da capa;
  - [ ] faixa "Guarde esta data";
  - [ ] mensagem aos convidados;
  - [ ] lista de presentes;
  - [ ] confirmação de presença;
  - [ ] perguntas frequentes.
- [ ] Convite Selado e Envelopado no Escuro: o envelope continua com as cores originais; só o conteúdo depois de aberto fica escuro.

**Acabamento do selo (Ideal e Exclusivo)**
- [ ] Dourado, Prata, Lacre vermelho e Cor do casamento no Convite Selado e no Envelopado.
- [ ] Monograma legível em todos os acabamentos.
- [ ] Animação de abertura idêntica em todos.

## 4. Seções (todos os planos)

- [ ] As setas ↑↓ mudam a ordem; ao salvar, o site segue a nova ordem nos 7 estilos.
- [ ] O menu do topo (Editorial, Jardim, Convite, Envelopado, Fotográfico, Portfólio) e a grade de atalhos do Portfólio seguem a nova ordem.
- [ ] Desmarcar uma seção a remove do site e do menu.
- [ ] Desmarcar "Confirmação de presença" ou "Lista de presentes" tem o mesmo efeito da chave nas abas próprias (as duas ficam sincronizadas).
- [ ] Clássico: ocultar "Nossa história" devolve as fotos dela para a galeria.
- [ ] Portfólio: ocultar "Contagem regressiva" remove a contagem da capa.
- [ ] "Voltar à ordem original do estilo" restaura a ordem.
- [ ] Trocar de estilo mantém a ordem escolhida; seções que o estilo novo não tem são ignoradas.

## 5. Dúvidas & hospedagem

**Perguntas frequentes (todos os planos)**
- [ ] Até 8 perguntas; a 9ª não pode ser adicionada.
- [ ] Pergunta sem resposta: ao salvar, o editor leva para a aba e avisa.
- [ ] No site: cada pergunta abre e fecha com clique, Enter ou Espaço; o foco é visível.
- [ ] Com a formatação ativada, a resposta aceita negrito, itálico e link.

**Hospedagem (Ideal e Exclusivo)**
- [ ] Até 3 locais; nome obrigatório.
- [ ] "Ver no mapa" abre o link informado ou, sem link, a busca pelo endereço no Google Maps.
- [ ] Um link `javascript:` ou `data:` é recusado ao salvar.
- [ ] O telefone vira link de ligação no celular.
- [ ] O código de desconto aparece destacado.
- [ ] Gratuito: os campos ficam bloqueados, com o aviso do plano Ideal.

## 6. Planos e segurança

- [ ] Gratuito tentando ativar recurso pago por fora do editor (ex.: chamada direta à API) recebe 403.
- [ ] Rebaixar um casamento do Ideal para o Gratuito:
  - [ ] o site deixa de mostrar fontes, fundo, selo, hospedagem e monograma;
  - [ ] a configuração fica salva e volta ao reassinar;
  - [ ] o casal continua conseguindo editar textos.
- [ ] Imagem de monograma apontando para foto de outro casamento ou URL externa é recusada (400).
- [ ] Exportação de dados (JSON): contém `font_pair`, `palette`, `sections`, `faq`, `lodging` e a foto com `purpose: brand`.

## 7. Envelopado — convite que se desdobra de lado

- [ ] Abrir o envelope: a animação lateral é a de antes; em seguida aparece a 1ª dobra (capa) e os controles ‹ › embaixo.
- [ ] › desdobra o próximo painel girando na dobra; o anterior fica visível na borda, um pouco mais escuro.
- [ ] Tocar no painel anterior volta para ele; ‹ fecha a dobra atual.
- [ ] Setas ← → do teclado navegam; antes de abrir o envelope, elas não fazem nada.
- [ ] Celular: deslizar para o lado troca de dobra; rolar para cima/baixo rola o conteúdo da dobra sem trocar.
- [ ] Seções longas (galeria, presentes, mural, história com fotos) rolam dentro da dobra, sem cortar conteúdo.
- [ ] "Conheça o nosso grande dia" e os links do menu da 1ª dobra levam à dobra certa.
- [ ] A ordem e a visibilidade da aba Seções valem para as dobras; seção vazia não vira dobra.
- [ ] O indicador mostra o nome da seção atual e os pontos de progresso.
- [ ] Leitor de tela: anuncia "dobra do convite, 2 de 6: Nossa história"; dobras fechadas não são lidas nem alcançadas pelo Tab.
- [ ] Com "reduzir movimento", a troca acontece sem giro.
- [ ] Larguras: 320 px, 375 px, tablet em pé e deitado, 1280 px, 1920 px (no desktop a dobra anterior aparece bem à esquerda).
- [ ] Fundo escuro e os 4 acabamentos de selo continuam funcionando.
- [ ] O Convite Selado não muda: continua como página rolando para baixo.

## 8. Desempenho

- [ ] Site sem par de fontes escolhido: nenhuma fonte nova é baixada (aba Rede).
- [ ] Com um par escolhido: só os 2 ou 3 arquivos daquele par são baixados.
- [ ] Lighthouse no celular sem regressão relevante.
