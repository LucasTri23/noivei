# Checklist & Timeline Personalizados — Design de Conteúdo do Motor de Regras

> Documento de pesquisa e design de conteúdo. **Não é especificação técnica** — nomes de flags são sugestões semânticas, não schema.
> Criado em 2026-07-03 · Autor: pesquisa assistida (Claude) a partir do rascunho do dono do produto · Decisões do produto fechadas em 2026-07-03 (§8).

### Como manter este documento

Este é o documento de referência para implementar o motor de regras do Checklist/Timeline — **puxe daqui**, não do rascunho original nem da conversa. Se algo mudar depois (uma pergunta, um prazo, uma regra):

1. Edite a tabela da seção correspondente (§3 perguntas, §4 tarefas por categoria, §5 timeline).
2. Se a mudança contradiz uma decisão do §8, atualize o item do §8 também — ele é a fonte da verdade para "o que já foi decidido".
3. Some uma linha no [changelog](#changelog) no final do arquivo com a data e o que mudou.

---

## Sumário

1. [Como este documento foi construído (fontes)](#1-fontes-e-metodologia)
2. [Conceitos do motor de regras](#2-conceitos-do-motor-de-regras)
3. [Questionário final de onboarding — 24 perguntas em 6 passos](#3-questionário-final-de-onboarding)
4. [Checklist completo por categoria (tarefa | prazo | condição)](#4-checklist-completo-por-categoria)
5. [Timeline — visão por fases temporais](#5-timeline--visão-por-fases)
6. [O que mudou em relação ao rascunho e por quê](#6-o-que-mudou-e-por-quê)
7. [Linguagem inclusiva — pontos sinalizados](#7-linguagem-inclusiva)
8. [Decisões do dono do produto](#8-decisões-do-dono-do-produto-resolvidas-em-2026-07-03)
9. [Changelog](#changelog)

---

## 1. Fontes e metodologia

O rascunho original (13 categorias, ~160 tarefas) foi validado e corrigido contra:

**Internacionais (padrão-ouro de prazos):**
- Zola — [Ultimate Wedding Planning Checklist](https://www.zola.com/expert-advice/your-ultimate-wedding-planning-checklist) (mês a mês, 12+ meses → pós-casamento)
- The Knot — [12-Month Wedding Planning Countdown](https://www.theknot.com/content/12-month-wedding-planning-countdown)
- Joy — [Destination Wedding Checklist](https://withjoy.com/blog/complete-destination-wedding-checklist/) e [Here Comes the Guide](https://www.herecomestheguide.com/wedding-ideas/the-ultimate-destination-wedding-checklist)

**Brasileiras (burocracia e tradições locais):**
- [Constance Zahn — casamento civil: prazos, documentos e regimes de bens](https://www.constancezahn.com/casamento-civil-prazos-documentos-e-regimes-de-bens/) e [casamento religioso](https://www.constancezahn.com/casamento-religioso-prazos-documentos-e-praticas/)
- [Lápis de Noiva — checklist](https://lapisdenoiva.com/checklist-para-casamento/) e [casamento na Igreja Católica](https://lapisdenoiva.com/casamento-na-igreja-catolica/)
- [Casar365 — Checklist do Casamento](https://casar365.com.br/checklist-do-casamento/), [iCasei — checklist](https://revista.icasei.com.br/checklist-de-casamento/), [Casamentos.com.br](https://www.casamentos.com.br/artigos/organizar-um-casamento-passo-a-passo--c2466)
- [Caseme — atualização de documentos pós-casamento](https://caseme.com.br/mudanca-para-nome-de-casada/), [Sinoreg-ES](https://sinoreg-es.org.br/saiba-como-atualizar-documentos-pos-casamento/)
- [Wise — checklist viagem internacional](https://wise.com/br/blog/check-list-viagem-internacional), [iCasei — lua de mel](https://revista.icasei.com.br/lua-de-mel-como-planejar/)

**Fatos-âncora confirmados pela pesquisa** (usados nos prazos abaixo):
- Local/espaço: reservar **12–18 meses** antes; foto/vídeo/buffet/banda: **9–12 meses**; flores e bolo: **6–8 meses**.
- Convites impressos: enviar **6–8 semanas** antes; prazo de RSVP **3–4 semanas** antes.
- **Habilitação civil no cartório**: dar entrada **~60 dias antes** (processo leva 15–30 dias com proclamas; a certidão de habilitação vale 90 dias). Certidão de nascimento atualizada emitida há menos de 90 dias; 2 testemunhas maiores e alfabetizadas; regime diferente de comunhão parcial exige **pacto antenupcial em Tabelionato de Notas ANTES da habilitação**.
- **Igreja Católica**: reservar a igreja até 1 ano e meio antes; iniciar documentação **~6 meses antes** (o processo matrimonial dura ~3 meses); Curso de Noivos idealmente **6 meses antes** (certificado exigido); certidão de batismo "para fins matrimoniais" com validade de 6 meses.
- Lua de mel internacional: planejar **6–12 meses antes**; Schengen exige passaporte com 3+ meses de validade além do retorno e **seguro viagem obrigatório**.
- Destination wedding: save the date **8–12 meses antes**; chegar ao destino **3–5 dias antes**; room block para convidados.
- Pós-casamento: agradecimentos em até 3 meses; ordem da troca de documentos: **certidão de casamento → RG → CPF → CNH → título de eleitor → passaporte** (CNH exige RG novo; passaporte exige tudo atualizado).

---

## 2. Conceitos do motor de regras

- **Fato (flag)**: resposta do questionário, ex.: `assessoria = nenhuma`, `local = praia`. Alguns fatos são **derivados**, não perguntados: `destination = true` se `local ∈ {outra_cidade, outro_pais}`; `mini_wedding = true` se `convidados ≤ 50`; `meses_disponiveis` calculado a partir da data do casamento.
- **Regra de exibição**: cada tarefa tem uma condição booleana sobre os fatos. Sem condição = tarefa universal (aparece para todos).
- **Prazo**: cada tarefa tem um *offset* relativo à data do casamento ("9 meses antes", "semana do casamento"). O checklist agrupa por categoria; a timeline agrupa pelo offset (ver §5).
- **Duas visões, um só dado**: Checklist (categoria) e Timeline (fase temporal) leem o mesmo conjunto de tarefas resolvidas pelas mesmas regras.
- **Padrão "mostrar por default"**: em caso de resposta "ainda não sei", a tarefa aparece (é mais seguro mostrar uma tarefa dispensável do que esconder uma essencial). O casal pode dispensar tarefas manualmente ("não se aplica").
- **Re-execução**: se o casal mudar uma resposta depois (ex.: decidiu contratar assessoria), as regras re-executam; tarefas já concluídas nunca somem — só ficam arquivadas.

---

## 3. Questionário final de onboarding

**24 perguntas, 6 passos temáticos** (dentro do teto de 20–30). Perguntas do rascunho que viraram fatos derivados ou tarefas opcionais estão justificadas no §6. Cada pergunta lista o que ela **liga/desliga**.

### Passo 1 — "Sobre o grande dia" (contexto básico)

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q1 | **Quando será o casamento?** (data ou mês estimado; "ainda não decidimos" permitido) | data / estimativa / não sei | **Âncora de toda a timeline.** Sem data: timeline em modo relativo ("assim que tiver data"). Adiciona a tarefa "Definir a data" se não souber. Noivados com menos de 12 meses **não** têm tratamento especial — tarefas com prazo vencido ficam marcadas como atrasadas normalmente (ver §5, regra 2). |
| Q2 | **Quantos convidados vocês esperam?** | até 50 / 51–100 / 101–200 / 200+ | ≤50 deriva `mini_wedding` (esconde tarefas de grande porte: gerador, segurança, mapa de mesas complexo). 150+ liga tarefas de logística (estacionamento/valet, transporte de convidados). Alimenta Convidados e Festa. |
| Q3 | **Qual a faixa de orçamento total?** | até R$ 30 mil / 30–80 mil / 80–150 mil / 150 mil+ | < 30 mil liga o bloco "modo econômico" (dicas e tarefas de corte de custo). > 150 mil liga bloco premium (concierge, valet, segurança, lounge). Faixas intermediárias: checklist padrão. |
| Q4 | **Quem participa da organização?** | só nós dois / com ajuda de família/amigos | Com família: liga "Alinhar expectativas e papéis com as famílias" e "Definir quem contribui com o quê". |
| Q5 | **Vão contratar assessoria/cerimonial?** | assessoria completa / só "assessoria do dia" / não / ainda não sei | **Não ou só do dia**: liga o bloco de auto-gestão (cronograma do dia D manual, planilha de fornecedores, responsável por imprevistos). **Completa**: esconde esse bloco e liga "Contratar assessoria" + "Reuniões periódicas com assessoria". "Assessoria do dia" (muito comum no BR) mantém a auto-gestão do planejamento, mas liga "Reunião de passagem com a assessoria do dia" 1 mês antes. |

### Passo 2 — "A cerimônia"

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q6 | **Como será o casamento civil?** | no cartório / civil no local da festa (juiz de paz / diligência) / já somos casados no civil / não teremos civil agora | Liga todo o bloco de habilitação (documentos, testemunhas, proclamas). "No local" adiciona custo/tarefa de diligência do cartório. "Já casados" esconde a categoria Documentação quase inteira. |
| Q7 | **Terá cerimônia religiosa ou simbólica?** | católica / evangélica ou outra religião / celebrante simbólico / não | **Católica**: Curso de Noivos, certidão de batismo, processo matrimonial, entrevista com o pároco, "efeito civil" (opcional). **Outra religião**: tarefas genéricas de aconselhamento/documentos da comunidade religiosa. **Simbólica**: contratar celebrante, roteiro da cerimônia. **Não**: esconde tudo isso. |
| Q8 | **Onde será?** | espaço de eventos na nossa cidade / campo ou fazenda / praia / em casa / outra cidade / outro país | Campo/praia/casa derivam `ar_livre` (plano B de chuva, gerador, conforto dos convidados, autorização para praia pública). Outra cidade/país deriva `destination` (bloco inteiro de logística de viagem, room block, welcome bag, chegar 3–5 dias antes; outro país adiciona documentação legal do país). |
| Q9 | **Vocês já sabem o regime de bens?** | comunhão parcial (padrão) / outro regime / ainda não sabemos | "Outro regime" liga "Fazer pacto antenupcial no Tabelionato de Notas **antes** da habilitação". "Não sabemos" liga "Pesquisar regimes de bens e decidir". |
| Q10 | **Alguém vai alterar o sobrenome?** | sim / não / ainda não sabemos | Liga/desliga o bloco pós-casamento de atualização de documentos (RG, CPF, CNH, título, passaporte, banco, plano de saúde). |

### Passo 3 — "A festa"

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q11 | **Como será a recepção?** | festa completa com pista / recepção sem pista (almoço/jantar) / não teremos recepção | Sem pista: esconde iluminação de pista, atrações de pista (não esconde música ambiente — ver §6). Sem recepção: esconde a categoria Festa inteira e reduz Fornecedores. |
| Q12 | **Música da festa** | DJ / banda / DJ + banda / playlist própria | Gera pipeline de contratação do(s) selecionado(s). Playlist própria: liga "Montar playlist e definir responsável pelo som". |
| Q13 | **Bebidas** | open bar completo / cerveja+vinho+drinks simples / sem álcool | Open bar: bartender, carta de drinks, cálculo de quantidade por convidado. Sem álcool: esconde tudo e liga "Definir bebidas não alcoólicas e bar de sucos/café". |
| Q14 | **Crianças entre os convidados?** | sim, muitas / algumas / não (adults only) | Sim: espaço kids/recreação (se 20+ crianças esperadas), cardápio infantil. Não: esconde e liga "Comunicar com delicadeza que a festa é só para adultos" (convite/site). |
| Q15 | **Terá cortejo?** (múltipla escolha) | padrinhos e madrinhas / daminhas e pajens / nenhum | Padrinhos: convidar (fazer o "pedido"), definir traje/paleta, organizar entrada. Daminhas/pajens: escolher trajes, ensaiar entrada, definir responsável pelas crianças no dia. |

### Passo 4 — "Fornecedores" (1 pergunta múltipla)

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q16 | **O que vocês pretendem contratar?** (múltipla escolha) | buffet · fotografia · filmagem · doces e bem-casados · bolo · flores e decoração · carro da cerimônia · cabine de fotos · iluminação cênica · som e estrutura · beleza (cabelo/make) · transporte de convidados | Cada item selecionado instancia o **pipeline de fornecedor** (6 etapas — ver categoria 6) com a janela de contratação certa para aquele tipo. Itens não selecionados não aparecem. DJ/banda já vêm de Q12. |

### Passo 5 — "Trajes e convites"

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q17 | **Vestido da noiva** e **Terno do noivo** (2 campos fixos, mesma tela) | sob medida / pronto (comprar) / alugado / ainda não sei (para cada um) | Sob medida: começar 10–11 meses antes + 2–3 provas. Alugado: "Retirar traje" (semana) + "Devolver traje" (pós). Comprado: esconde devolução, liga "Guardar/preservar o traje" (pós, opcional). |
| Q18 | **Segundo traje para a festa?** | sim / não | Liga "Escolher e provar segundo traje" + logística de troca no dia. |
| Q19 | **Convites** | impressos / digitais / os dois | Impressos: aprovar arte, imprimir, envelopar, entregar/postar (6–8 semanas antes). Digitais: criar arte digital e disparar. |
| Q20 | **Vão enviar save the date?** | sim / não | Liga criação e envio (8+ meses antes; 10–12 se destination). |
| Q21 | **Como será a confirmação de presença (RSVP)?** | online (site/WhatsApp) / manual (telefone/pessoalmente) | Online: criar página/formulário RSVP, configurar lembretes automáticos, acompanhar painel. Manual: designar responsável pela rodada de ligações 4–3 semanas antes. |

### Passo 6 — "Depois do sim"

| # | Pergunta | Opções | O que liga/desliga |
|---|---|---|---|
| Q22 | **Lua de mel** | internacional / nacional / vamos adiar (minimoon depois) / não teremos | Internacional: passaporte, visto, vacinas, seguro viagem (obrigatório em Schengen/alguns países), câmbio, chip/roaming. Nacional: versão enxuta. Adiar: mesmas tarefas movidas para pós-casamento sem data fixa. Não: esconde a categoria. |
| Q23 | **Momentos especiais no dia** (múltipla escolha) | making of / first look / votos personalizados / nenhum | Making of: reservar espaço, cronograma de beleza, itens de cena. First look: sessão de fotos antes da cerimônia no cronograma. Votos: escrever (1 mês antes) e revisar (semana). |
| Q24 | **Eventos ao redor do casamento** (múltipla escolha) | chá de panela / chá bar ou chá de casa nova / despedida de solteiro(a) / jantar de ensaio / nenhum | Cada um liga um mini-bloco (definir data, lista, local) 2–4 meses antes. Jantar de ensaio liga tarefas na semana do casamento. |

**Contagem: 24 perguntas.** Q17 é na verdade 2 campos fixos numa só tela — "Traje da noiva" e "Traje do noivo" — e conta como 1 item do questionário. Todas as perguntas têm opção "ainda não sei" onde fizer sentido → comportamento "mostrar por default" + tarefa de decisão correspondente.

---

## 4. Checklist completo por categoria

Formato: **Tarefa | Prazo sugerido | Condição de exibição**. Sem condição = universal. Total: **~181 tarefas possíveis** (nenhum casal vê todas).

### 4.1 📋 Planejamento & Organização (14 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Definir a data do casamento | 12+ meses | somente se Q1 = "ainda não sei" |
| Definir estilo e visão do casamento (mood board) | 12+ meses | sempre |
| Definir orçamento total e teto por categoria | 12+ meses | sempre |
| Montar lista preliminar de convidados | 12+ meses | sempre |
| Alinhar expectativas e papéis com as famílias | 12+ meses | Q4 = com família |
| Pesquisar e contratar assessoria/cerimonial | 12+ meses | Q5 = completa ou "assessoria do dia" |
| Visitar e reservar o local da cerimônia e da festa | 12–18 meses | sempre |
| Criar planilha/central de fornecedores e contratos | 11 meses | Q5 = não ou só do dia |
| Planejar o cronograma macro do planejamento | 11 meses | Q5 = não ou só do dia |
| Reuniões periódicas de acompanhamento com a assessoria | recorrente | Q5 = completa |
| Criar site do casamento | 10 meses | sempre (recomendado; obrigatório se Q21 = online ou destination) |
| Pesquisar clima/estação do local e definir plano B de chuva | 10 meses | `ar_livre` (Q8 ∈ campo/praia/casa) |
| Verificar autorização/licença para evento em área pública | 8 meses | Q8 = praia (praia pública) |
| Planejar logística geral da viagem (datas, roteiro do grupo) | 10–12 meses | `destination` |

### 4.2 💰 Orçamento & Pagamentos (12 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Abrir conta/caixinha separada para o casamento | 12+ meses | sempre |
| Definir quem contribui com o quê (casal, famílias) | 12+ meses | Q4 = com família |
| Montar plano de pagamentos (entrada/parcelas por fornecedor) | 11 meses | sempre |
| Revisar bloco "modo econômico": priorizar 3 itens essenciais e cortar o resto | 11 meses | Q3 = até 30 mil |
| Pesquisar datas/dias com desconto (sexta, domingo, baixa temporada) | 11 meses | Q3 = até 30 mil |
| Contratar concierge | 6 meses | Q3 = 150 mil+ |
| Contratar valet | 6 meses | Q3 = 150 mil+ |
| Contratar segurança | 6 meses | Q3 = 150 mil+ |
| Montar lounge VIP | 6 meses | Q3 = 150 mil+ |
| Revisão de meio do caminho: gasto real × orçado | 6 meses | sempre |
| Reservar fundo de imprevistos (~10% do orçamento) | 12+ meses | sempre |
| Quitar/agendar pagamentos finais e gorjetas em envelopes | semana do casamento | sempre |

### 4.3 👥 Convidados & RSVP (12 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Fechar a lista final de convidados | 9 meses | sempre |
| Coletar endereços/contatos dos convidados | 8 meses | sempre |
| Convidar padrinhos e madrinhas (fazer o "pedido") | 9 meses | Q15 inclui padrinhos |
| Definir daminhas e pajens e conversar com os pais | 8 meses | Q15 inclui daminhas/pajens |
| Negociar room block / tarifas de grupo em hotéis | 9 meses | `destination` ou 30%+ convidados de fora |
| Publicar informações de viagem/hospedagem no site | 8 meses | `destination` |
| Comunicar que a festa é só para adultos (site + boca a boca) | 6 meses | Q14 = não |
| Criar página/formulário de RSVP com lembretes | 3 meses | Q21 = online |
| Designar responsável pela rodada de confirmações por telefone | 4 semanas | Q21 = manual |
| Acompanhar confirmações e cobrar pendentes | 4–3 semanas | sempre |
| Fechar número final e informar buffet/espaço | 2 semanas | sempre |
| Montar mapa de mesas / seating chart | 2 semanas | Q2 > 50 (mini wedding: opcional) |

### 4.4 ⛪ Cerimônia (15 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Reservar igreja/local da cerimônia religiosa | 12–18 meses | Q7 = católica ou outra religião |
| Fazer o Curso de Noivos (preparação matrimonial) | 6 meses | Q7 = católica |
| Reunir documentação da igreja (batismo p/ fins matrimoniais, crisma) | 6 meses (processo dura ~3) | Q7 = católica |
| Entrevista/entrega do processo matrimonial com o pároco | 4 meses | Q7 = católica |
| Verificar exigências da comunidade religiosa (aconselhamento, documentos) | 6 meses | Q7 = outra religião |
| Decidir se o religioso terá efeito civil (dispensa cerimônia no cartório) | 8 meses | Q7 = católica/outra E Q6 ≠ já casados |
| Contratar celebrante e construir o roteiro da cerimônia | 6–8 meses | Q7 = simbólica |
| Agendar data/hora no cartório | 4 meses | Q6 = no cartório |
| Contratar diligência do cartório / juiz de paz para o local | 6 meses | Q6 = civil no local |
| Definir músicas da cerimônia (entrada, alianças, saída) | 3 meses | Q7 ≠ não OU Q6 = civil no local |
| Contratar músicos da cerimônia | 4–6 meses | Q16 inclui som/música de cerimônia (ou oferta cruzada de Q12) |
| Definir ordem do cortejo e quem entra com quem | 2 meses | Q15 ≠ nenhum |
| Ensaiar a entrada (cortejo, daminhas, pajens) | semana do casamento | Q15 ≠ nenhum |
| Escrever votos personalizados | 1 mês | Q23 inclui votos |
| Definir "saída dos noivos" (pétalas, bolhas — arroz é proibido em muitos espaços) | 1 mês | sempre (opcional, dispensável) |

### 4.5 🎉 Recepção & Festa (16 tarefas)

*Categoria inteira oculta se Q11 = não teremos recepção.*

| Tarefa | Prazo | Condição |
|---|---|---|
| Definir estilo da festa (formal, rústico, pé na areia...) | 11 meses | sempre |
| Fechar cardápio com o buffet (+ degustação) | 6 meses | Q16 inclui buffet |
| Definir formato do serviço (empratado, buffet, finger food) | 6 meses | Q16 inclui buffet |
| Cardápio infantil | 4 meses | Q14 = sim |
| Contratar recreação / espaço kids | 4 meses | Q14 = sim (sugerir se muitas crianças) |
| Contratar bartender e fechar carta de drinks | 5 meses | Q13 = open bar |
| Calcular quantidade de bebidas por convidado | 3 meses | Q13 ≠ sem álcool |
| Definir bebidas não alcoólicas / bar de sucos e café | 3 meses | Q13 = sem álcool |
| Fechar repertório com DJ/banda (incluindo "não toca") | 2 meses | Q12 ≠ playlist |
| Montar playlist própria e definir responsável pelo som | 2 meses | Q12 = playlist |
| Contratar iluminação de pista | 5 meses | Q11 = festa com pista |
| Definir música/atração da hora do bolo e primeira dança | 2 meses | Q11 = festa com pista |
| Alugar gerador de energia | 4 meses | `ar_livre` E Q2 > 50 |
| Planejar estacionamento/valet ou transporte de convidados | 3 meses | Q2 > 150 OU Q3 = 150 mil+ OU `ar_livre` |
| Definir lembrancinhas/bem-casados da saída | 3 meses | sempre (opcional, dispensável) |
| Montar cronograma da festa (entrada, brindes, bolo, buquê, fim) | 1 mês | Q5 = não/só do dia (assessoria completa faz isso) |

### 4.6 🤝 Fornecedores — pipeline (6 × N tarefas)

Cada fornecedor selecionado em Q12/Q16 instancia o pipeline abaixo. **Confirma o desenho do rascunho** — é exatamente como The Knot/Zola estruturam.

| Etapa do pipeline | Prazo (relativo à janela do fornecedor) |
|---|---|
| Pesquisar e pedir orçamentos (3+ opções) | início da janela |
| Comparar propostas e visitar/degustar | início da janela |
| Assinar contrato (ler multa, cláusula de cancelamento) | fechamento da janela |
| Registrar pagamentos (entrada + parcelas) | contínuo |
| Reconfirmar presença, horários e endereço | 2 semanas antes |
| Avaliar o fornecedor | pós-casamento |

**Janelas de contratação por tipo** (âncora da pesquisa):

| Fornecedor | Contratar até | Condição |
|---|---|---|
| Buffet | 9–12 meses | Q16 |
| Fotografia | 9–12 meses | Q16 |
| Filmagem | 9–12 meses | Q16 |
| Banda / DJ | 8–10 meses | Q12 |
| Flores e decoração | 6–8 meses | Q16 |
| Bolo | 6 meses | Q16 |
| Doces e bem-casados | 6 meses | Q16 |
| Beleza (cabelo/make) — inclui prova | 5 meses | Q16 |
| Som/estrutura e iluminação cênica | 5 meses | Q16 |
| Cabine de fotos | 3–4 meses | Q16 |
| Carro da cerimônia | 3–4 meses | Q16 |
| Transporte de convidados | 3 meses | Q16 ou `destination` |

Extras específicos: buffet → "degustação"; fotografia → "ensaio pré-wedding (opcional)" 4–6 meses; fornecedores de fora do destino → "negociar taxa de deslocamento/hospedagem do fornecedor" (`destination`).

### 4.7 👗 Trajes & Beleza (15 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Pesquisar estilo do vestido da noiva e do terno do noivo | 10–11 meses | sempre |
| Encomendar vestido/terno sob medida | 10 meses | Q17 = sob medida (noiva e/ou noivo) |
| Comprar vestido/terno pronto + ajustes | 6–8 meses | Q17 = pronto (noiva e/ou noivo) |
| Reservar vestido/terno de aluguel | 6 meses | Q17 = alugado (noiva e/ou noivo) |
| 1ª prova do vestido/terno | 3 meses | Q17 = sob medida ou pronto |
| Prova final do vestido/terno | 2–3 semanas | sempre |
| Escolher e provar o segundo traje da festa | 4 meses | Q18 = sim |
| Comprar sapatos e acessórios (véu, joias, gravata/lapela) | 4 meses | sempre |
| "Amaciar" os sapatos usando em casa | 1 mês | sempre |
| Definir paleta/traje de padrinhos e madrinhas e comunicar | 6 meses | Q15 inclui padrinhos |
| Providenciar trajes de daminhas e pajens | 4 meses | Q15 inclui daminhas/pajens |
| Prova de cabelo e maquiagem | 2 meses | Q16 inclui beleza |
| Agendar rotina de cuidados (pele, cabelo, barba, unhas) | 6 meses | sempre (opcional, dispensável) |
| Retirar vestido/terno alugado | semana do casamento | Q17 = alugado |
| Comprar/gravar as alianças | 3 meses | sempre |

*(Alianças ficam aqui por conveniência de compra; aparecem também no kit do dia D.)*

### 4.8 💌 Papelaria & Identidade Visual (10 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Definir identidade visual (monograma, paleta, tipografia) | 9 meses | sempre |
| Criar e enviar save the date | 8+ meses (10–12 se `destination`) | Q20 = sim |
| Aprovar arte do convite | 4–5 meses | sempre |
| Imprimir convites | 3–4 meses | Q19 = impressos ou os dois |
| Envelopar e entregar/postar convites | 6–8 semanas | Q19 = impressos ou os dois |
| Disparar convites digitais | 6–8 semanas | Q19 = digitais ou os dois |
| Encomendar papelaria do dia (menu, plaquinhas, número de mesa) | 2 meses | sempre (opcional, dispensável) |
| Encomendar itens de saída (lágrimas de alegria, pétalas) | 1 mês | sempre (opcional, dispensável) |
| Criar lista de presentes (registry) e divulgar no site | 8 meses | sempre |
| Encomendar welcome bag para convidados de fora | 1 mês | `destination` |

### 4.9 ✈️ Lua de Mel (11 tarefas)

*Categoria oculta se Q22 = não. Se Q22 = "vamos adiar", todas viram tarefas pós-casamento sem prazo fixo.*

| Tarefa | Prazo | Condição |
|---|---|---|
| Escolher destino e época (checar alta temporada/clima) | 8–10 meses | Q22 ≠ não |
| Definir orçamento da lua de mel | 8 meses | Q22 ≠ não |
| Reservar voos e hospedagem | 6 meses | Q22 ≠ não |
| Emitir/renovar passaportes (validade 3+ meses além do retorno) | 6 meses | Q22 = internacional |
| Verificar e solicitar visto do destino | 6 meses | Q22 = internacional |
| Verificar vacinas exigidas (ex.: febre amarela) e certificado internacional | 4 meses | Q22 = internacional |
| Contratar seguro viagem (obrigatório em Schengen, Cuba etc.) | 2 meses | Q22 = internacional |
| Planejar câmbio / cartão internacional / conta multimoeda | 1 mês | Q22 = internacional |
| Providenciar chip internacional ou eSIM | 2 semanas | Q22 = internacional |
| Montar roteiro e reservar passeios/restaurantes | 2 meses | Q22 ≠ não |
| Fazer as malas da lua de mel | semana do casamento | Q22 = internacional ou nacional (viagem logo após) |

### 4.10 📑 Documentação & Civil (10 tarefas)

*Categoria quase toda oculta se Q6 = "já somos casados no civil" (fica só o que depender de Q7).*

| Tarefa | Prazo | Condição |
|---|---|---|
| Pesquisar regimes de bens e decidir | 5 meses | Q9 = ainda não sabemos |
| Fazer pacto antenupcial no Tabelionato de Notas | 4 meses (**antes da habilitação**) | Q9 = outro regime |
| Emitir certidão de nascimento atualizada (validade 90 dias) | 3 meses | Q6 ≠ já casados |
| Escolher 2 testemunhas (maiores e alfabetizadas) e reunir documentos delas | 3 meses | Q6 ≠ já casados |
| Dar entrada na habilitação do casamento no cartório | ~60 dias antes | Q6 ≠ já casados |
| Acompanhar publicação dos proclamas / retirar certidão de habilitação | 1 mês | Q6 ≠ já casados |
| Levar a certidão de habilitação à igreja (casamento com efeito civil) | 1 mês | Q7 = católica/outra E optou por efeito civil |
| Confirmar data/horário da cerimônia no cartório | 1 mês | Q6 = no cartório |
| Confirmar diligência do juiz de paz no local | 2 semanas | Q6 = civil no local |
| Verificar exigências legais para casar no exterior (ou casar no civil no Brasil antes) | 8 meses | Q8 = outro país |

### 4.11 📆 Semana do Casamento (13 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Reconfirmar todos os fornecedores (horário, endereço, contato) | semana | Q5 = não/só do dia (assessoria completa assume) |
| Reunião final de alinhamento com assessoria/cerimonial | semana | Q5 = completa ou só do dia |
| Entregar cronograma do dia + lista de fotos ao fotógrafo | semana | Q16 inclui fotografia |
| Separar envelopes de pagamento final e gorjetas | semana | sempre |
| Montar kit emergência (costura, analgésico, absorvente, carregador...) | semana | sempre |
| Retirar trajes (aluguel) / buscar traje na loja | semana | Q17 = alugado ou ajustes finais |
| Fazer unhas, cabelo, depilação, barba (rotina de véspera) | 1–2 dias antes | sempre |
| Ensaio geral no local + jantar de ensaio | 1–2 dias antes | Q24 inclui jantar de ensaio OU Q15 ≠ nenhum |
| Check-in no hotel / preparar suíte da noite de núpcias | véspera | sempre (opcional, dispensável) |
| Viajar para o destino (3–5 dias antes) | 3–5 dias antes | `destination` |
| Receber convidados de fora / entregar welcome bags | 2 dias antes | `destination` |
| Conferir e separar itens do dia (alianças, votos, documentos, trocado) | véspera | sempre |
| Delegar celular e contatos a uma pessoa de confiança | véspera | Q5 = não |

### 4.12 ❤️ Dia do Casamento (14 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Café da manhã reforçado + hidratação | dia | sempre |
| Making of (fotos da preparação) | dia | Q23 inclui making of |
| Sessão first look + fotos do casal antes da cerimônia | dia | Q23 inclui first look |
| Seguir cronograma de beleza (cabelo/make com horário) | dia | Q16 inclui beleza |
| Conferir se alianças e votos estão com a pessoa certa | dia | sempre |
| Entrega de presentinho/carta entre o casal | dia | sempre (opcional, dispensável) |
| Receber fornecedores no local (ou delegar) | dia | Q5 = não |
| Coordenar entrada do cortejo | dia | Q15 ≠ nenhum |
| Reler os votos uma última vez | dia | Q23 inclui votos |
| Sessão de fotos pós-cerimônia (casal + famílias + padrinhos) | dia | Q16 inclui fotografia |
| Momento a sós do casal antes de entrar na festa | dia | sempre (opcional, recomendado) |
| Cumprir rituais da festa (brinde, bolo, buquê, primeira dança) | dia | Q11 = festa completa |
| Garantir transporte de presentes/itens pessoais no fim da noite | dia | Q5 = não |
| Saída dos noivos (pétalas/bolhas/velas) | dia | se tarefa 4.4 "saída" não dispensada |

### 4.13 🎁 Pós-casamento (11 tarefas)

| Tarefa | Prazo | Condição |
|---|---|---|
| Devolver trajes alugados | até 3 dias depois | Q17 = alugado |
| Enviar lembranças/agradecimentos aos convidados | até 3 meses | sempre (opcional, dispensável) |
| Enviar agradecimentos aos padrinhos e fornecedores-chave | até 1 mês | Q15 inclui padrinhos |
| Retirar a certidão de casamento no cartório | 1–2 semanas | Q6 ≠ já casados |
| Atualizar RG (primeiro da fila) | 1º mês | Q10 = sim |
| Atualizar CPF (online, Receita Federal) | 1º mês | Q10 = sim |
| Atualizar CNH no Detran (exige RG novo) | 2º mês | Q10 = sim |
| Atualizar título de eleitor, passaporte, banco, plano de saúde | até 3 meses | Q10 = sim |
| Avaliar fornecedores (fecha o pipeline de cada um) | 1º mês | por fornecedor contratado |
| Preservar o traje / revelar álbum e backup das fotos | até 3 meses | Q17 = comprado/sob medida; álbum se Q16 inclui foto |
| Planejar a minimoon/lua de mel adiada | quando quiser | Q22 = vamos adiar |

---

## 5. Timeline — visão por fases

A Timeline **não é outro dado**: é a mesma lista de tarefas resolvidas pelas mesmas regras, agrupada pelo *offset* temporal em vez da categoria. Proposta de **9 fases** (nomes pensados para UI, alinhados a Zola/The Knot e aos checklists brasileiros):

| Fase | Janela | Tema da fase | Principais tarefas que caem aqui |
|---|---|---|---|
| **1. Fundação** | 12+ meses | Decidir o essencial | data, orçamento, lista preliminar, assessoria, reservar local e igreja, visão/mood board, fundo de imprevistos |
| **2. Grandes contratações** | 9–12 meses | Fornecedores que esgotam agenda | buffet, foto, vídeo, banda/DJ, site do casamento, save the date (destination), traje sob medida, room block, padrinhos |
| **3. Fornecedores e trajes** | 6–9 meses | Completar o time | flores/decoração, bolo/doces, celebrante, Curso de Noivos + docs da igreja, save the date, registry, paleta dos padrinhos, lua de mel (reservas), efeito civil |
| **4. Detalhes e papelaria** | 4–6 meses | Dar forma ao dia | arte do convite, impressão, beleza (contratar), segundo traje, trajes de daminhas, cartório (agendar), pacto antenupcial, degustação, gerador/plano B, eventos paralelos (chá, despedida) |
| **5. Burocracia e confirmações** | 2–4 meses | Papelada e reta administrativa | habilitação civil (~60 dias), 1ª prova do traje, alianças, prova de make, RSVP online no ar, repertório, cálculo de bebidas, cronograma da festa, seguro viagem |
| **6. Reta final** | 3–8 semanas | Convites na rua e fechamento | enviar convites (6–8 sem), cobrar RSVP (4–3 sem), número final ao buffet (2 sem), mapa de mesas, votos, prova final do traje, reconfirmar fornecedores |
| **7. Semana do casamento** | 7–1 dias | Logística e autocuidado | kit emergência, envelopes de pagamento, retirar trajes, ensaio + jantar, viagem ao destino (3–5 dias antes), welcome bags, véspera |
| **8. O grande dia** | dia | Viver o dia | making of, first look, cortejo, rituais da festa, saída |
| **9. Recém-casados** | pós | Fechar ciclos | devolver traje, certidão, troca de documentos (RG→CPF→CNH→resto), agradecimentos, avaliações, álbum/preservação, minimoon |

**Regras de adaptação da timeline:**

1. **Âncora**: tudo é calculado a partir de Q1 (data). Sem data, a timeline mostra as fases em modo relativo com aviso "defina a data para ativar os prazos".
2. **Noivados curtos (`meses_disponiveis < 12`)**: sem tratamento especial — as tarefas cujo offset ideal já passou simplesmente ficam marcadas como **atrasadas** e permanecem assim (sem selo de prioridade, sem fusão de fases) até o casal marcar como concluída.
3. **Deslocamentos condicionais**: algumas tarefas mudam de fase conforme flags — ex.: save the date vai da fase 3 para a fase 2 se `destination`; tarefas de lua de mel somem da fase 3–5 e reaparecem na fase 9 se Q22 = "adiar".
4. **Fases vazias somem**: um mini wedding civil sem viagem pode não ter nada na fase 3 — a UI oculta a fase em vez de mostrá-la vazia.
5. **Visão sugerida na UI**: fases como seções expansíveis, com contador "8 de 14 concluídas"; dentro da fase, ordenar por offset e depois por categoria (o chip de categoria mantém o vínculo visual com o Checklist).

---

## 6. O que mudou e por quê

### Adicionado (faltava no rascunho)

| Mudança | Motivo (fonte) |
|---|---|
| **Pergunta da data do casamento (Q1)** | Sem ela não existe timeline. Todos os checklists de referência são ancorados na data. É a pergunta mais importante do onboarding e não estava no rascunho. |
| **Bloco de Beleza** (prova de make/cabelo, rotina de cuidados) | Presente em 100% dos checklists BR e internacionais (Zola: 5 meses; Lápis de Noiva). O rascunho não tinha nenhuma tarefa de beleza. |
| **Alianças (comprar/gravar)** | Zola: 2 meses antes. Ausente do rascunho — e é literalmente o item sem o qual não há cerimônia. |
| **Site do casamento + lista de presentes (registry)** | Padrão em Zola/The Knot/iCasei; além disso o RSVP online (que o rascunho já queria) pressupõe o site. |
| **Prazos legais do civil**: habilitação ~60 dias antes, certidão de nascimento < 90 dias, 2 testemunhas, pacto antenupcial ANTES da habilitação | Constance Zahn / cartórios. O rascunho dizia só "agendar cartório / documentação" — sem os prazos o casal perde a janela legal (a habilitação vale 90 dias e demora ~30). |
| **"Efeito civil" do casamento religioso** | Especificidade brasileira relevante: dispensa cerimônia separada no cartório; afeta as duas categorias (Cerimônia e Documentação). |
| **Opção "assessoria do dia"** | No Brasil é o meio-termo mais vendido; o rascunho tratava assessoria como binário sim/não, o que erraria as regras para a maioria dos casais reais. |
| **Kit emergência, envelopes de gorjeta, cronograma de beleza, chegada 3–5 dias antes (destination), room block, welcome bag** | Zola (9 meses: emergency kit; 1 semana: pagamentos), Here Comes the Guide / Joy (destination). |
| **Ordem correta da troca de documentos** (RG → CPF → CNH → título → passaporte) | Caseme/Sinoreg: CNH exige RG novo; passaporte exige tudo atualizado. O rascunho listava os documentos sem a dependência. |
| **Plano B de chuva / gerador / autorização de praia pública** | Checklists BR de casamento no campo/praia; o rascunho perguntava "campo? praia?" mas não gerava nenhuma tarefa com isso. |
| **Fundo de imprevistos (~10%)** | Recomendação recorrente em todas as fontes de orçamento. |

### Alterado

| Mudança | Motivo |
|---|---|
| **Questionário reduzido de ~50 para 24 perguntas** | Fatos deriváveis viraram derivação: *Mini Wedding* = convidados ≤ 50; *Destination* = resposta de local (Q8); *padre/pastor/juiz* = consequência do tipo de cerimônia (Q6+Q7), não 4 perguntas separadas. Perguntas de detalhe (menu personalizado, lágrimas de alegria, chuva de arroz, cor das madrinhas, hotel) viraram **tarefas opcionais dispensáveis** — perguntar tudo no onboarding é interrogatório; dispensar uma tarefa custa 1 tap. |
| **Removidas do onboarding: "quem paga?", "vai financiar?", "vai parcelar?"** | Não alteram o *conjunto* de tarefas (todas caem em "montar plano de pagamentos") — pertencem ao módulo de Orçamento, não à triagem. Mantida só a faixa de orçamento (Q3), que liga blocos econômico/premium como o rascunho queria. |
| **Regra "sem pista → ocultar DJ" corrigida** | DJ/som fazem música ambiente de recepções sem pista (almoço/jantar). A música agora é pergunta própria (Q12); "sem pista" esconde só iluminação de pista e rituais de pista. |
| **"Chuva de arroz" rebatizada para "saída dos noivos (pétalas/bolhas)"** | Arroz é proibido/desaconselhado na maioria dos espaços (atrai pombos, escorrega); os checklists atuais recomendam alternativas. Mantida como tarefa opcional. |
| **RSVP: de "obrigatório?" para "canal (online/manual)"** | Todo casamento precisa confirmar presença; a variável real é o canal — online gera as tarefas de página/lembretes (como o rascunho já previa), manual gera a rodada de ligações. |
| **Prazo do convite fixado em 6–8 semanas (envio) e RSVP 3–4 semanas** | Zola/The Knot; fontes BR variam de 1 a 3 meses — adotado 6–8 semanas com produção 3–4 meses antes (impresso). |
| **Bloco premium (>150 mil)** — a pesquisa propôs 1 tarefa-mãe, mas foi **revertido por decisão do produto (§8)** | Voltou a ser 4 tarefas soltas (Concierge, Valet, Segurança, Lounge VIP), como no rascunho original — já refletido em §4.2. |
| **Categoria "Festa" renomeada "Recepção & Festa" e ganhou trilha sem pista** | Recepção sem pista (almoço/mini wedding) é comum; a categoria original assumia festa com pista como único formato. |

### Confirmado (o rascunho já estava certo)

- **A tese central do produto** — checklist condicional por perfil — é validada: os líderes (Zola, The Knot, Bridebook) personalizam por questionário; nenhum player BR relevante faz isso bem. O diferencial é real.
- **Pipeline de 6 etapas por fornecedor** (orçar → comparar → contratar → pagar → confirmar → avaliar): bate exatamente com a prática do setor. Mantido na íntegra, só com janelas de contratação por tipo.
- **Curso de Noivos ~6 meses antes**: confirmado pelas dioceses (ideal 6 meses; processo matrimonial dura ~3).
- **Lua de mel internacional → passaporte/visto/seguro/câmbio/chip**: confirmado e ampliado (vacinas, validade do passaporte 3+ meses além do retorno).
- **Destination → hospedagem/transporte/informar convidados/logística**: confirmado e ampliado (room block, welcome bag, chegada antecipada, fornecedores com taxa de deslocamento).
- **Sem troca de sobrenome → ocultar atualização de documentos**: confirmado; adicionada apenas a ordem de dependência entre documentos.
- **13 categorias**: mantidas (com 2 renomeações), a divisão original faz sentido e mapeia bem para navegação.
- **Estimativas de volume**: os cenários do rascunho (~74 a ~195 tarefas por perfil) continuam plausíveis com as ~181 tarefas deste documento.

---

## 7. Linguagem inclusiva

> **Decisão do produto (2026-07-03, §8 item 4)**: tom tradicional para trajes. A sugestão de pergunta neutra "por pessoa" **não foi adotada** — o produto usa "Traje da noiva" e "Traje do noivo" como 2 campos fixos (já refletido em §3/Q17 e §4.7). As demais sugestões desta seção (Q10 sobre sobrenome, paleta de padrinhos/madrinhas, "making of" neutro, cortejo) **seguem adotadas** como estão descritas na tabela abaixo — não foram questionadas pelo dono do produto.

O casamento civil igualitário é lei no Brasil desde 2013 (Resolução CNJ 175). Pontos sinalizados **para decisão posterior do produto** — nenhuma mudança de conteúdo religioso foi feita:

| Termo do rascunho | Situação | Sugestão documentada |
|---|---|---|
| "Curso de Noivos" | É o nome oficial da preparação católica — **manter** quando `Q7 = católica` (mudar o nome confundiria). | Fora do contexto católico, usar "preparação matrimonial". |
| "Vestido da noiva" / "traje do noivo" | Assume casal noiva+noivo e um vestido. | Sugestão original: questionário neutro "por pessoa". **Não adotado** — produto optou pelo tom tradicional (§8, item 4): "Traje da noiva" e "Traje do noivo" como 2 campos fixos, mantido em §3 (Q17) e §4.7. |
| "Madrinhas usarão cor específica" | Só madrinhas. | "Padrinhos e madrinhas" / "paleta do cortejo". Aplicado. |
| "Nome de casada" (implícito na troca de documentos) | Qualquer um dos dois pode alterar o sobrenome (Código Civil, art. 1.565 §1º). | Pergunta Q10 é neutra: "Alguém vai alterar o sobrenome?". Aplicado. |
| "Making of da noiva" | Ambos podem ter making of. | "Making of (preparação do casal)". Aplicado. |
| "Chá de panela" / "despedida de solteiro(a)" | Tradições fortes — manter como opções, mas ao lado de "chá bar" e "chá de casa nova" (Q24). | Aplicado como múltipla escolha. |
| "Daminhas e pajens" | Termo tradicional consagrado; sem alternativa neutra difundida no BR. | **Manter** (trocar geraria estranhamento); apenas evitar assumir gênero nas tarefas ("trajes das daminhas e pajens", não "vestido das daminhas" + "traje dos pajens" separados). |
| "Entrada da noiva com o pai" | Não virou tarefa fixa neste design. | Tarefa neutra "definir ordem do cortejo e quem entra com quem" cobre todas as configurações. Aplicado. |

**Princípio geral adotado**: neutralidade nos textos do sistema (perguntas, tarefas universais), tradição preservada nos textos condicionais (se o casal escolheu Igreja Católica, os termos católicos aparecem como são).

---

## 8. Decisões do dono do produto (resolvidas em 2026-07-03)

1. **"Ainda não sei" → mostrar a tarefa por padrão.** ✅ Confirmado (comportamento do §2 mantido como está).
2. **Noivados curtos (<12 meses)**: ❌ Sem compressão de fases e sem selo "prioridade". A tarefa fica **atrasada** normalmente e permanece assim até o casal marcar como concluída — sem tratamento especial. (Revisar §5, regra 2 — ver nota abaixo.)
3. **Bloco premium (orçamento > R$150 mil)**: ✅ **4 tarefas soltas** (Concierge, Valet, Segurança, Lounge VIP), como no rascunho original — não uma tarefa-mãe com subitens. (Revisar §4.2 e §6 — ver nota abaixo.)
4. **Linguagem**: ✅ **Tom tradicional.** Usar "vestido da noiva" e "terno/traje do noivo" (não as redações neutras genéricas do §7). O produto é assumidamente para casais noiva+noivo (mesma decisão já tomada no onboarding com `bride_name`/`groom_name`).
5. **Re-execução de regras**: ✅ Confirmado — tarefas concluídas nunca somem, só arquivam.
6. **Traje por pessoa**: ✅ Confirmado que **não duplica** — são **2 campos fixos**: "Traje da noiva" e "Traje do noivo" (não uma "instância genérica por membro do casal"). Mesmo padrão de `bride_name`/`groom_name` já usado em Dados do Casamento.

Todas as seções deste documento (§3, §4.2, §4.7, §5, §7) já foram atualizadas para refletir as 6 decisões acima — não há edição pendente.

---

## Changelog

| Data | Mudança |
|---|---|
| 2026-07-03 | Documento criado a partir da pesquisa (fontes em §1) sobre o rascunho original do produto. |
| 2026-07-03 | Decisões 1–6 do dono do produto registradas em §8 e aplicadas em §3 (Q17), §4.2 (bloco premium), §4.7 (trajes), §5 (regra de noivado curto) e §7 (linguagem). |
