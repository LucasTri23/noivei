# Homologação — Nossa História e formatação de textos

Roteiro de testes manuais para o ambiente de homologação. Pré-requisito: as
migrations `20261118000001_vendor-category-hierarchy.sql` e
`20261118000002_site-story-moments-and-photos.sql` aplicadas no banco de
homologação, nessa ordem.

**Larguras de teste**

| Dispositivo | Largura | Como testar |
|---|---|---|
| Celular | 375 px (e 320 px para o pior caso) | DevTools → iPhone SE / aparelho real |
| Tablet | 768 px e 1024 px (retrato e paisagem) | DevTools → iPad / aparelho real |
| Desktop | 1280 px e 1920 px | Navegador maximizado |

Em cada largura, conferir: sem rolagem horizontal, textos sem corte, fotos sem
distorção e espaço reservado antes de a foto carregar (sem "pulo" de layout).

**Massa de dados sugerida**: um casamento com história de 3 parágrafos, 4
momentos (2 com data de dia, 1 só com mês, 1 sem data), 6 fotos (2 ligadas a
momentos, 4 soltas, pelo menos uma vertical e uma panorâmica) e um casamento
antigo, sem nada disso configurado.

---

## 1. Compatibilidade (fazer primeiro, com o casamento antigo)

- [ ] Site publicado de um casamento antigo continua idêntico nos 5 estilos (comparar com produção ou capturas anteriores).
- [ ] Clássico antigo: as polaroids da história continuam usando as 8 primeiras fotos da galeria.
- [ ] Textos antigos com `*`, `-`, `#` ou `_` aparecem exatamente como foram digitados (formatação desligada).
- [ ] Editor da história mostra "Apresentação original" selecionada e a pré-visualização avisa que o site publicado não muda.
- [ ] Cadastrar momentos e fotos **sem** escolher apresentação: o site publicado não muda.

## 2. Editor (painel do casal)

- [ ] Botão "Ativar formatação" só aparece desligado; salvar textos não ativa a formatação.
- [ ] Ativar formatação → barra com Negrito, Itálico, Tachado e Link; Ctrl+B / Ctrl+I funcionam.
- [ ] Aba "Visualizar" mostra o mesmo resultado do site.
- [ ] Desativar formatação pede confirmação e o texto volta a aparecer literal.
- [ ] Colar `<script>alert(1)</script>`, `[x](javascript:alert(1))` e `<img src=x onerror=alert(1)>`: nada executa, nem no editor nem no site.
- [ ] Criar 20 momentos; o 21º é recusado com mensagem clara.
- [ ] Enviar várias fotos de uma vez (JPG, PNG, WEBP); progresso aparece; fotos grandes chegam otimizadas (≤ 2400 px).
- [ ] 25ª foto é recusada; arquivo acima de 8 MB é recusado com mensagem.
- [ ] HEIC: no Safari é convertido; no Chrome aparece a mensagem pedindo JPG.
- [ ] Legenda salva ao sair do campo; associar foto a um momento; reordenar fotos e momentos com as setas.
- [ ] Excluir momento: as fotos dele continuam, como fotos soltas.
- [ ] Excluir foto: some do editor e do site; a barra de armazenamento diminui.
- [ ] Barra de armazenamento aumenta ao enviar fotos da história; ao estourar a cota, o envio é recusado.
- [ ] Fotos da história **não** aparecem na lista da galeria nem contam no limite de fotos do estilo.
- [ ] Pressionar Enter nos campos de momento não envia o formulário do site.
- [ ] Usuário convidado sem permissão no módulo "site" não consegue ver nem editar a história.

## 3. Por estilo — repetir em celular, tablet e desktop

Para cada estilo: escolher cada apresentação suportada, salvar e conferir o
site publicado e a pré-visualização do editor.

### Clássico (padrão: linha do tempo)
- [ ] Linha do tempo: linha central com coração, momentos em ordem cronológica, sem data no fim.
- [ ] Celular: linha do tempo vira coluna única, legível.
- [ ] Ilustrado e galeria: polaroids com legenda.
- [ ] Depois de escolher a nova apresentação, todas as fotos da galeria voltam para a seção Galeria (nenhuma "some").

### Portfólio (padrão: galeria)
- [ ] Grade assimétrica sem buracos com 1, 2, 3, 5 e 6 fotos.
- [ ] Menu e links rápidos mostram "história" só quando há conteúdo.
- [ ] Legendas discretas, legíveis sobre a foto.

### Editorial (padrão: ilustrado)
- [ ] Capitular no primeiro parágrafo; pares de fotos deslocados.
- [ ] Celular: fotos empilham sem deslocamento quebrado.

### Jardim Romântico (padrão: ilustrado)
- [ ] Molduras em arco e marcadores de folha nos momentos.
- [ ] Título personalizado da história continua sendo usado.

### Convite Selado (padrão: ilustrado, sem linha do tempo)
- [ ] Envelope fechado ao abrir o site; nenhum conteúdo da história visível antes de abrir.
- [ ] Clicar no selo: animação de abertura igual à de produção (duração, sequência, som/efeitos se houver).
- [ ] Teclado: Tab chega ao selo, Enter/Espaço abre, o foco vai para o conteúdo.
- [ ] Com "reduzir movimento" ativo no sistema, o convite abre direto, sem animação.
- [ ] História aparece com fotos menores e borda dourada.
- [ ] Opções do editor não incluem "linha do tempo".

## 4. Troca de estilo

- [ ] Clássico com "linha do tempo" → trocar para Convite: site mostra o modo ilustrado; editor avisa que a escolha não é suportada.
- [ ] Voltar para Clássico: linha do tempo reaparece sem precisar escolher de novo.
- [ ] Momentos, fotos, legendas e formatação continuam intactos após várias trocas.
- [ ] Galeria com mais fotos que o limite do novo estilo: fotos excedentes ficam guardadas e reaparecem ao voltar.

## 5. Outros campos com formatação

- [ ] Mensagem aos convidados, cerimônia, recepção e traje: negrito, itálico e link renderizam nos 5 estilos.
- [ ] Links abrem com segurança (sem acesso à página de origem) e só aceitam http, https e mailto.
- [ ] Quebras de linha simples são mantidas; linha em branco separa parágrafos.

## 6. Exportação de dados (LGPD)

- [ ] Exportar JSON: contém `site_story.moments`, `site_story.photos` e `purpose` nas fotos.
- [ ] Exportar PDF: seções de momentos e legendas com datas formatadas.

## 7. Desempenho e acessibilidade

- [ ] Fotos da história carregam sob demanda (aba Rede: só baixam ao rolar).
- [ ] Todas as fotos têm texto alternativo (legenda, título do momento ou nome do casal).
- [ ] Lighthouse no celular sem regressão relevante em relação a produção.
