# Termos de Uso — Wednest

> ⚠️ **Aviso importante:** este é um **rascunho gerado com apoio de IA**, produzido a partir da leitura direta do código-fonte do sistema Wednest (funcionalidades, integrações de pagamento e regras de negócio realmente implementadas nesta data). Ele **não substitui a revisão de um(a) advogado(a) habilitado(a)** antes da publicação — em especial para confirmar o enquadramento tributário da empresa, os dados de identificação da pessoa jurídica, o foro contratual e, sobretudo, as cláusulas de responsabilidade sobre a intermediação de pagamentos e sobre o repasse de valores de presentes ao casal via Mercado Pago. Todos os campos marcados como `[PREENCHER]` precisam ser completados por quem administra o negócio antes de qualquer publicação.

**Última atualização:** [DATA DE PUBLICAÇÃO — PREENCHER]

---

## 1. Aceitação dos termos

Estes Termos de Uso ("Termos") regem o acesso e uso da plataforma **Wednest** ("Plataforma", "Serviço"), disponibilizada por:

- Razão social: `[RAZÃO SOCIAL — PREENCHER]`
- CNPJ: `[CNPJ — PREENCHER]`
- Endereço: `[ENDEREÇO COMPLETO — PREENCHER]`
- Contato: `[E-MAIL DE CONTATO — PREENCHER]`

Ao criar uma conta, marcar a caixa de aceite no cadastro e/ou utilizar o Wednest de qualquer forma, você concorda integralmente com estes Termos e com a [Política de Privacidade](./politica-de-privacidade.md) e a [Política de Cookies](./politica-de-cookies.md), que fazem parte integrante deste instrumento. Se você não concorda com qualquer disposição destes Termos, não deve utilizar o Serviço.

Estes Termos são regidos pelo Código Civil brasileiro, pelo Código de Defesa do Consumidor (Lei nº 8.078/1990, "CDC"), pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD") e pelo Marco Civil da Internet (Lei nº 12.965/2014).

---

## 2. Objeto do serviço

O Wednest é uma plataforma (SaaS — *Software as a Service*) de planejamento de casamentos, que oferece, de acordo com o plano contratado:

- **Checklist e timeline de planejamento**, personalizados por meio de um questionário inicial (onboarding);
- **Gestão de convidados e RSVP**, incluindo o envio de link único para cada convidado confirmar presença sem necessidade de criar conta;
- **Módulo financeiro**, para controle de orçamento, lançamentos, fornecedores, parcelas e cotações do casamento;
- **Organização de mesas**, para distribuição dos convidados confirmados;
- **Site do casamento**, uma página pública personalizável para divulgação de informações do evento aos convidados;
- **Lista de presentes**, com itens vinculados a lojas externas (link) e, opcionalmente, itens pagos diretamente pelo aplicativo (ver cláusula 7);
- **Central de arquivos**, para armazenamento de contratos e documentos relacionados ao casamento;
- **Padrinhos e cortejo**, para organização de papéis e ordem de entrada no casamento;
- **Acesso compartilhado à conta**, permitindo que mais de uma pessoa (ex.: os dois noivos) gerencie o mesmo casamento, conforme os limites do plano contratado.

O Wednest não presta serviços de assessoria/cerimonial de casamento, não contrata fornecedores em nome do casal e não garante a realização, qualidade ou cumprimento de contratos entre o casal e fornecedores/prestadores externos eventualmente cadastrados na Plataforma pelo próprio usuário.

---

## 3. Cadastro e conta

### 3.1. Como se cadastrar

O cadastro pode ser feito por e-mail e senha (com verificação por código enviado ao e-mail informado) ou por login social via conta Google. O cadastro por e-mail/senha é protegido por verificação anti-robô (CAPTCHA).

### 3.2. Veracidade das informações e maioridade

Você é responsável por fornecer informações verdadeiras, completas e atualizadas no cadastro, e por manter a confidencialidade de sua senha. **Ao se cadastrar, você declara ser maior de 18 (dezoito) anos e plenamente capaz nos termos da lei civil brasileira.** O Wednest não realiza, nesta versão do produto, verificação técnica de idade no momento do cadastro, confiando na veracidade dessa declaração; a criação de conta por pessoa menor de idade, sem a devida representação/assistência legal, é vedada e de responsabilidade exclusiva de quem a realizar. Identificada uma conta em desacordo com esta cláusula, o Wednest poderá suspendê-la ou excluí-la, sem prejuízo de outras medidas cabíveis.

### 3.3. Uma conta, um casamento

Cada conta principal está associada a um único casamento. O acesso de múltiplas pessoas ao mesmo casamento ocorre por meio do recurso de convite/acesso compartilhado, disponível conforme os limites do plano contratado, e não pela criação de contas adicionais para o mesmo evento.

### 3.4. Suspensão e encerramento pelo Wednest

O Wednest pode suspender ou encerrar o acesso de uma conta, a qualquer tempo, em caso de: violação destes Termos; uso fraudulento ou abusivo da Plataforma (incluindo tentativas de burlar limites de rate limiting, autenticação ou verificação anti-robô); determinação judicial ou de autoridade competente; ou risco à segurança de outros usuários ou da própria Plataforma. Sempre que possível, o usuário será previamente notificado.

---

## 4. Planos, preços e cobrança recorrente

### 4.1. Modalidades de plano

O Wednest oferece um plano gratuito, com limites de uso (ex.: quantidade de convidados, fornecedores, usuários com acesso ao casamento, espaço de armazenamento), e planos pagos, que podem ser contratados em duas modalidades de cobrança:

- **Pagamento único**: cobrança única, sem renovação automática; o acesso aos recursos do plano permanece válido pelo período divulgado na tela de planos no momento da contratação;
- **Assinatura recorrente (mensal)**: cobrança automática mensal, que se repete até que o usuário efetue o cancelamento.

Os preços, limites e benefícios de cada plano são exibidos na tela de planos da Plataforma e podem ser alterados a qualquer momento pelo Wednest, sem efeito retroativo sobre períodos já pagos.

### 4.2. Processamento dos pagamentos

Todos os pagamentos de planos são processados pelo **Mercado Pago**, por meio de redirecionamento para o ambiente de checkout do próprio Mercado Pago (Checkout Pro, para pagamento único; assinatura/Preapproval, para cobrança recorrente). **O Wednest não recebe, não processa e não armazena dados de cartão de crédito/débito**; a confirmação de pagamento é recebida por meio de notificação (webhook) do Mercado Pago, validada por assinatura criptográfica, e é essa confirmação — não uma alegação do navegador do usuário — que efetivamente libera o acesso ao plano contratado.

### 4.3. Cancelamento de assinatura recorrente

Assinaturas mensais podem ser canceladas a qualquer momento pelo usuário, na tela de gerenciamento de planos, ou selecionando o plano gratuito. O cancelamento interrompe **cobranças futuras**, mas não gera reembolso automático do período em curso já cobrado, ressalvado o direito de arrependimento previsto na cláusula 4.5. Após o cancelamento, o acesso aos recursos do plano pago permanece válido até o fim do período já pago (ou é imediatamente rebaixado ao plano gratuito, conforme a regra vigente exibida ao usuário no momento do cancelamento).

Planos de pagamento único não possuem renovação automática nem rotina de cancelamento equivalente — o acesso ao plano contratado simplesmente permanece válido pelo período informado na contratação e não é renovado ao final desse prazo.

### 4.4. Direito do consumidor e reembolso

Nos termos do art. 49 do CDC, o consumidor que contratar o Wednest fora do estabelecimento comercial (o que inclui, tipicamente, a contratação pela internet) tem direito de arrependimento no prazo de **7 (sete) dias corridos** a contar da contratação, com direito à devolução integral dos valores eventualmente pagos, desde que o serviço ainda não tenha sido integralmente utilizado/fruído de forma incompatível com o exercício desse direito. Solicitações de reembolso, seja no prazo de arrependimento, seja por qualquer outro motivo previsto em lei, devem ser feitas pelo canal de atendimento indicado na cláusula 11. `[REVISAR ESTA CLÁUSULA COM ADVOGADO(A) — a política comercial de reembolso além do prazo legal de 7 dias, se houver, deve ser definida pela empresa e detalhada aqui.]`

### 4.5. Cupons e descontos

O Wednest pode, a seu critério, disponibilizar cupons promocionais que concedem desconto percentual ou fixo sobre o valor de determinado plano. Cupons têm prazo de validade, regras de uso definidas no momento da divulgação e podem ser encerrados a qualquer momento, sem aviso prévio, ressalvados os direitos já adquiridos por usuários que os tenham resgatado dentro do prazo de vigência.

---

## 5. Presente de casamento pago pelo aplicativo — natureza da intermediação

Esta cláusula merece atenção especial, pois define a natureza jurídica da relação entre o Wednest, o casal e o convidado que opta por presentear pelo aplicativo.

### 5.1. Como funciona

O casal pode habilitar, para itens específicos da sua lista de presentes, a opção de recebimento do valor do presente diretamente pelo aplicativo. Para isso, o próprio casal conecta sua conta pessoal do Mercado Pago à Plataforma (por meio de autorização OAuth). Quando um convidado opta por pagar um presente dessa forma:

- O pagamento é processado com as credenciais da conta Mercado Pago do **próprio casal**, e não da conta do Wednest;
- O valor pago pelo convidado é **dividido automaticamente no momento da transação** (mecanismo de *split*/marketplace do Mercado Pago): a parcela correspondente à comissão de intermediação do Wednest (percentual de plataforma, definido e divulgado na Plataforma) é retida pelo Wednest, e o valor restante é depositado **diretamente na conta Mercado Pago do casal**;
- **O dinheiro do presente não transita, em nenhum momento, por conta bancária ou conta de pagamento de titularidade do Wednest.**

### 5.2. Natureza da relação — o Wednest não é parte na relação civil do presente

O Wednest atua, nessa modalidade, **exclusivamente como intermediador tecnológico e financeiro** entre o convidado que deseja presentear e o casal que deseja receber o presente. **O Wednest não é parte na relação civil de doação/presente estabelecida entre o convidado e o casal** — essa relação (a liberalidade do presente, eventuais expectativas quanto ao seu uso, eventuais desentendimentos entre convidado e casal sobre o presente) é inteiramente alheia ao Wednest, que apenas fornece a infraestrutura tecnológica de pagamento e retém uma comissão pela intermediação prestada.

Em consequência:

- O Wednest não garante, não fiscaliza e não se responsabiliza pela destinação dada pelo casal ao valor recebido;
- Eventuais disputas entre convidado e casal sobre o presente (arrependimento do convidado após o pagamento, divergência sobre o item presenteado, insatisfação de qualquer natureza) devem ser resolvidas diretamente entre convidado e casal, sem envolvimento do Wednest como parte;
- A responsabilidade do Wednest, nessa modalidade, limita-se ao correto funcionamento técnico do mecanismo de intermediação e split de pagamento, e ao repasse ao casal do valor efetivamente recebido do convidado, descontada a comissão de intermediação;
- Estornos, contestações de cobrança (chargeback) ou cancelamentos de pagamento são tratados de acordo com as políticas e prazos do próprio Mercado Pago, enquanto processador da transação.

### 5.3. Responsabilidade do casal

O casal que conecta sua própria conta Mercado Pago para receber presentes pelo aplicativo é o único responsável por manter essa conta regular perante o Mercado Pago e a legislação aplicável (incluindo eventuais obrigações fiscais sobre os valores recebidos), isentando o Wednest de qualquer responsabilidade nesse sentido.

### 5.4. Convidado anônimo

O convidado que paga um presente pelo aplicativo não cria conta na Plataforma. Essa transação é anônima quanto à identidade da Plataforma (o Wednest não solicita e-mail, telefone, CPF ou qualquer outro dado do convidado além de um nome opcional, usado apenas para identificar o presenteador na lista do casal). Eventual necessidade de identificação completa do pagador para fins de comprovação fiscal ou disputa de pagamento é regida pelas políticas do próprio Mercado Pago, processador da transação.

---

## 6. Conteúdo inserido pelo usuário

### 6.1. Dados de convidados — responsabilidade do casal

O casal é responsável por inserir na Plataforma dados de convidados (nome, telefone, e-mail e demais informações do módulo de Convidados, Mesas e Padrinhos), que são pessoas **terceiras**, não usuárias diretas do Wednest. Ao inserir esses dados, **o casal declara possuir base legal válida, nos termos da LGPD, para tratar esses dados pessoais** (tipicamente por ter relação pessoal prévia com o convidado e legítimo interesse em organizar seu próprio evento social), e assume integral responsabilidade perante o convidado e perante a legislação de proteção de dados por essa inserção, incluindo eventuais reclamações do convidado quanto à forma como foi cadastrado ou contatado. O Wednest atua, quanto a esses dados, como operador (ver Política de Privacidade, item 2.2), processando-os unicamente para viabilizar as funcionalidades solicitadas pelo próprio casal.

### 6.2. Fotos e documentos

O casal é responsável pela titularidade e pelos direitos sobre fotos e documentos que envia à Plataforma, incluindo fotos publicadas no site público do casamento e na lista de presentes (que ficam publicamente acessíveis a qualquer pessoa com o link) e documentos enviados à Central de Arquivos (que ficam armazenados em ambiente privado, acessível apenas ao casal e aos membros autorizados daquele casamento). O Wednest não analisa previamente o conteúdo enviado e não se responsabiliza por infrações a direitos de terceiros (como direitos autorais ou de imagem) decorrentes de conteúdo enviado pelo próprio usuário, reservando-se o direito de remover conteúdo notificado como infrator ou ilícito.

### 6.3. Conteúdo do site público do casamento

O site do casamento gerado pela Plataforma é público quando publicado pelo casal, ficando acessível a qualquer pessoa que tenha o link (endereço), independentemente de autenticação. O casal é responsável por avaliar quais informações deseja tornar públicas dessa forma.

---

## 7. Propriedade intelectual

O Wednest, sua marca, layout, código-fonte, funcionalidades, banco de dados de catálogo de tarefas/checklist e demais elementos da Plataforma (excluído o conteúdo inserido pelos próprios usuários) são de propriedade do Wednest ou de seus licenciadores, protegidos pela Lei nº 9.610/1998 (Direitos Autorais) e pela Lei nº 9.279/1996 (Propriedade Industrial), sendo vedada sua reprodução, engenharia reversa, distribuição ou uso não autorizado.

O usuário mantém a titularidade sobre o conteúdo que insere na Plataforma (textos, fotos, dados do próprio casamento), concedendo ao Wednest uma licença limitada, não exclusiva, para armazenar, processar e exibir esse conteúdo estritamente na medida necessária para a prestação do Serviço (incluindo, quando aplicável, a exibição pública do site do casamento conforme configurado pelo próprio casal).

---

## 8. Limitação de responsabilidade

Na máxima extensão permitida pela legislação aplicável, e sem prejuízo dos direitos assegurados ao consumidor pelo CDC:

- O Wednest não garante disponibilidade ininterrupta ou livre de erros da Plataforma, embora envide esforços razoáveis para mantê-la estável e segura;
- O Wednest não se responsabiliza por perdas decorrentes de uso indevido da conta pelo próprio usuário (incluindo compartilhamento de senha), por indisponibilidade de terceiros integrados (Mercado Pago, Supabase, Vercel, Cloudflare) fora do controle razoável do Wednest, ou por conteúdo inserido por outros usuários;
- Conforme detalhado na cláusula 5, o Wednest não responde por questões relativas à relação civil de presente entre convidado e casal, atuando apenas como intermediador tecnológico e financeiro dessa transação;
- Nada nesta cláusula exclui responsabilidades que não podem ser limitadas por lei, como as decorrentes de dolo, culpa grave, ou de disposições de ordem pública do Código de Defesa do Consumidor.

---

## 9. Proteção de dados pessoais

O tratamento de dados pessoais pelo Wednest é detalhado na [Política de Privacidade](./politica-de-privacidade.md) e na [Política de Cookies](./politica-de-cookies.md), documentos que integram estes Termos.

---

## 10. Rescisão e exclusão de conta

O usuário pode encerrar sua conta a qualquer momento pela tela de Perfil. A exclusão segue o mecanismo de duas etapas descrito na Política de Privacidade (exclusão lógica por 30 dias, com possibilidade de reativação mediante contato com o suporte, seguida de expurgo definitivo dos dados). O cancelamento de uma assinatura recorrente não exclui automaticamente a conta nem os dados do casamento — são operações independentes.

---

## 11. Canal de atendimento

Dúvidas, solicitações relativas a dados pessoais, reembolsos ou qualquer outro assunto relacionado a estes Termos podem ser encaminhadas para: `[E-MAIL DE CONTATO/SUPORTE — PREENCHER]`.

---

## 12. Alterações destes termos

Estes Termos podem ser alterados a qualquer momento, para refletir mudanças no produto, na legislação aplicável ou em nossas práticas comerciais. Alterações relevantes serão comunicadas com destaque na Plataforma. O uso continuado do Serviço após a comunicação de uma alteração implica concordância com os novos termos.

---

## 13. Disposições gerais e foro

Estes Termos constituem o acordo integral entre o usuário e o Wednest quanto ao objeto aqui tratado. Caso qualquer disposição seja considerada nula ou inexequível, as demais permanecerão em pleno vigor.

Fica eleito o foro da comarca de `[CIDADE/UF DO FORO — PREENCHER]` para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja, **ressalvado o direito do consumidor de optar pelo foro de seu domicílio**, nos termos do art. 101, I, do Código de Defesa do Consumidor.
