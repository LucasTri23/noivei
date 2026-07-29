# Política de Privacidade — Wednest

> ⚠️ **Aviso importante:** este é um **rascunho gerado com apoio de IA**, produzido a partir da leitura direta do código-fonte do sistema Wednest (banco de dados, integrações e regras de negócio realmente implementadas nesta data). Ele **não substitui a revisão de um(a) advogado(a) habilitado(a)** antes da publicação — em especial para confirmar o enquadramento tributário da empresa, os dados de identificação da pessoa jurídica, o foro contratual e as cláusulas de responsabilidade sobre pagamentos e repasses via Mercado Pago. Todos os campos marcados como `[PREENCHER]` precisam ser completados por quem administra o negócio antes de qualquer publicação.

**Última atualização:** [DATA DE PUBLICAÇÃO — PREENCHER]

---

## 1. Quem trata os seus dados (Controlador)

Esta Política de Privacidade descreve como o **Wednest** ("nós", "plataforma", "Wednest"), operado por:

- Razão social: `[RAZÃO SOCIAL — PREENCHER]`
- Nome fantasia: Wednest
- CNPJ: `[CNPJ — PREENCHER]`
- Endereço: `[ENDEREÇO COMPLETO — PREENCHER]`
- E-mail de contato geral: `[contato@noivei.com.br — CONFIRMAR SE É O CANAL OFICIAL A SER PUBLICADO]`
- Encarregado(a) pelo tratamento de dados pessoais (DPO), nos termos do art. 41 da Lei nº 13.709/2018 (LGPD): `[NOME DO ENCARREGADO — PREENCHER]`
- Canal exclusivo para exercício de direitos do titular de dados: `[E-MAIL DO ENCARREGADO/PRIVACIDADE — PREENCHER, ex.: privacidade@wednest.com.br]`
- Foro/jurisdição: ver Termos de Uso, item de Foro.

coleta, usa, armazena e compartilha dados pessoais no contexto do serviço de planejamento de casamento oferecido através do site e aplicação web do Wednest.

Esta política é regida pela **Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)**, pelo **Marco Civil da Internet (Lei nº 12.965/2014)** e, no que couber, pelo **Código de Defesa do Consumidor (Lei nº 8.078/1990)**.

---

## 2. Estrutura do serviço e dois grupos de titulares de dados

É importante entender, antes de tudo, que o Wednest trata dados pessoais de **dois grupos de pessoas diferentes**, com naturezas jurídicas distintas:

### 2.1. O casal (usuário direto da plataforma)

O casal (noivos/noivas) cria uma conta, contrata o serviço e insere seus próprios dados pessoais para usar as funcionalidades de planejamento (checklist, orçamento, convidados, site do casamento, etc.). Em relação a esses dados, **o Wednest é o Controlador**, nos termos do art. 5º, VI, da LGPD: nós decidimos as finalidades e os meios de tratamento desses dados.

### 2.2. Os convidados do casamento (dados de terceiros, inseridos pelo casal)

O casal, para usar funcionalidades como a lista de convidados, RSVP, cortejo/padrinhos e mesas, insere na plataforma dados pessoais de **terceiros que não são usuários diretos do Wednest** — os convidados do casamento (nome, telefone, e-mail, status de confirmação).

Em relação a esses dados, a relação jurídica é mais sutil e deve ser lida com atenção:

- **O casal é o Controlador dos dados dos próprios convidados.** É o casal quem decide inserir aquele convidado na lista, quem define a finalidade (convidar para o evento e organizar RSVP) e quem tem a relação direta com aquela pessoa. É o casal quem deve ter uma base legal válida para tratar esses dados (tipicamente, o legítimo interesse de organizar seu próprio evento social e/ou a execução de um convite social, já que normalmente há uma relação pessoal prévia entre o casal e seus convidados).
- **O Wednest atua como Operador**, nos termos do art. 5º, VII, da LGPD, em relação aos dados dos convidados: nós apenas processamos esses dados **em nome e sob as instruções do casal**, fornecendo a infraestrutura técnica (banco de dados, envio de link de RSVP, armazenamento) para que o casal execute a própria finalidade dele.
- Consequência prática: **o casal, ao inserir dados de convidados na plataforma, declara e garante que tem base legal e legitimidade para fazer esse tratamento**, e assume a responsabilidade por eventuais reclamações desses terceiros quanto à forma como foram cadastrados, contatados ou tiveram seus dados usados. O Wednest se compromete a tratar esses dados com o mesmo padrão de segurança e confidencialidade aplicado aos dados do próprio casal, e apenas para as finalidades estritamente necessárias ao funcionamento das funcionalidades contratadas (ver Termos de Uso, cláusula de conteúdo inserido pelo usuário).
- O convidado que deseja exercer direitos de titular (ex.: solicitar a exclusão do seu nome/telefone da lista) deve, em regra, contatar diretamente o casal que o cadastrou; o Wednest, como operador, também disponibiliza um canal de contato (item 8 abaixo) para encaminhar essas solicitações caso o convidado não saiba identificar o casal responsável ou o casal não responda.

### 2.3. Convidado que faz um pagamento de presente pelo app

Quando um convidado paga um presente da lista de presentes diretamente pelo aplicativo (Mercado Pago), ele **não cria conta no Wednest** — é uma transação anônima, na qual apenas um nome opcional é informado (para identificar quem deu o presente na lista do casal). Ver detalhes na seção 4.6.

---

## 3. Quais dados coletamos e para quê

### 3.1. Dados do casal (cadastro e conta)

| Dado | Onde é usado | Finalidade | Base legal (LGPD) |
|---|---|---|---|
| Nome completo | Perfil, exibição no app | Identificação do usuário, personalização da experiência | Execução de contrato (art. 7º, V) |
| E-mail | Login, comunicações transacionais | Autenticação, recuperação de senha, comunicações sobre a conta | Execução de contrato (art. 7º, V) |
| Senha | Autenticação (gerida pelo Supabase Auth) | Login seguro. **A senha nunca é armazenada em texto puro em nosso banco de dados** — o gerenciamento de credenciais é feito pelo provedor de autenticação (Supabase Auth), que aplica hashing criptográfico | Execução de contrato (art. 7º, V) |
| Foto de perfil (avatar) | Perfil do usuário | Personalização da experiência | Consentimento (art. 7º, I), ao fazer o upload voluntariamente |
| Dados de cadastro via Google (nome, e-mail, foto) | Login social (Google OAuth) | Alternativa de autenticação sem senha própria | Consentimento (art. 7º, I) / Execução de contrato |
| Resposta ao desafio de CAPTCHA (Cloudflare Turnstile) | Tela de cadastro | Prevenção a criação automatizada de contas em massa (bots) | Legítimo interesse (art. 7º, IX) / Cumprimento de obrigação legal e segurança |
| Papel/função na conta (`role`: usuário, admin, suporte) | Controle de acesso interno | Segurança e administração da plataforma | Legítimo interesse (art. 7º, IX) |

### 3.2. Dados do casamento (inseridos pelo casal sobre o próprio evento)

| Dado | Finalidade | Base legal |
|---|---|---|
| Nome dos noivos, data e cidade do casamento, local (venue) | Organização do evento, exibição no site do casal, cálculo de prazos do checklist | Execução de contrato |
| Orçamento total planejado, estilo do casamento (rústico, clássico, moderno, boho, minimalista, romântico, outro) | Personalização do checklist/timeline e das recomendações do produto | Execução de contrato |
| Respostas ao questionário de onboarding (preferências de planejamento) | Geração automática de checklist e timeline personalizados | Execução de contrato |
| Cor de identidade visual do casamento, foto de capa | Personalização visual do painel e do site público do casamento | Execução de contrato |
| Lançamentos financeiros (categoria, fornecedor, descrição, valores, parcelas, cotações) | Módulo de Financeiro/Orçamento do casamento | Execução de contrato |
| Conteúdo do site público do casamento (slug, textos, dress code, fotos de galeria) | Publicação do site do casal para os convidados | Execução de contrato / Consentimento (para as fotos publicadas) |

### 3.3. Dados de acesso compartilhado à conta ("juntar contas")

Nos planos pagos, mais de uma pessoa pode ter acesso ao mesmo casamento (até 5 ou 10 usuários, a depender do plano). Para isso, tratamos: e-mail/identificador do convite, status do convite (pendente, aceito, revogado) e vínculo de qual conta de usuário está associada a qual casamento. Base legal: execução de contrato.

### 3.4. Dados de convidados (terceiros — ver seção 2.2)

| Dado | Finalidade | Observação |
|---|---|---|
| Nome | Identificação na lista de convidados e no RSVP | Inserido pelo casal |
| Telefone e/ou e-mail | Confirmação de presença (RSVP), validação de identidade no link de RSVP | Inserido pelo casal; nunca é exposto de volta na tela pública de RSVP (usado apenas para conferência interna) |
| Status de confirmação (confirmado/pendente/recusado) | Organização do evento pelo casal | Gerado pela resposta do próprio convidado ou lançado manualmente pelo casal |
| Quantidade de acompanhantes / nomes de acompanhantes | Controle de quantas pessoas de fato comparecerão | Inserido pelo convidado no próprio RSVP ou pelo casal |
| Papel no cortejo (padrinho, madrinha, daminha, pajem etc.) | Módulo de Padrinhos & Entradas | Inserido pelo casal, a partir da própria lista de convidados |
| Mesa/assento designado | Módulo de Mesas | Inserido pelo casal |

**Não coletamos, hoje, restrição alimentar ou qualquer outro dado sensível de convidados** — essa informação não existe no cadastro atual de convidados do Wednest. Caso essa funcionalidade venha a ser criada no futuro, esta política será atualizada antes de sua ativação, com a base legal apropriada (tipicamente consentimento específico, por poder envolver dado sensível de saúde, nos termos do art. 11 da LGPD).

### 3.5. Documentos e arquivos enviados

| Dado | Onde fica armazenado | Visibilidade | Finalidade |
|---|---|---|---|
| Documentos e contratos com fornecedores (PDF, Word, Excel, texto, imagens) | Bucket privado de armazenamento (Supabase Storage) | Privado — acessível apenas pelo casal/membros do casamento autenticados | Central de Arquivos do casamento |
| Fotos da galeria do site do casamento | Bucket público de armazenamento | Público — exibidas no site do casamento, acessível a qualquer visitante do link | Divulgação do site do casal aos convidados |
| Fotos de itens da lista de presentes | Bucket público de armazenamento | Público — exibidas na lista de presentes do site | Ilustração dos itens da lista de presentes |

O upload é feito diretamente do navegador do usuário para o serviço de armazenamento (Supabase Storage), com validação de tipo de arquivo e limite de tamanho por arquivo.

### 3.6. Dados de pagamento

**O Wednest nunca recebe, processa ou armazena o número do cartão de crédito/débito, CVV ou dados sensíveis de pagamento dos usuários.** Todo o processamento de pagamento (assinatura de planos e, quando aplicável, pagamento de presentes) é feito pelo **Mercado Pago**, por meio de redirecionamento para o ambiente seguro do próprio Mercado Pago (Checkout Pro, para pagamentos únicos, e Preapproval, para assinaturas recorrentes). O Wednest armazena apenas:

- Identificadores da transação (referência interna, ID da preferência/assinatura no Mercado Pago, status do pagamento);
- Valor cobrado, plano contratado, datas de vigência;
- Em relação a cupons de desconto: código utilizado e desconto aplicado.

Confirmamos, a partir da integração implementada, que a comunicação de confirmação de pagamento (webhook) é validada por assinatura criptográfica (HMAC), para impedir que terceiros forjem notificações falsas de pagamento aprovado.

### 3.7. Presente pago pelo aplicativo (marketplace de presentes)

Quando o casal habilita o pagamento de um item da lista de presentes diretamente pelo app, e um convidado opta por pagar por esse meio:

- O convidado **não cria conta** — a transação é anônima, e apenas um **nome opcional** é solicitado, exclusivamente para constar como "presenteado por" na lista do casal;
- O valor pago é processado por meio da conta do Mercado Pago do **próprio casal** (que precisa conectar sua conta MP via OAuth para habilitar esse recurso) — o dinheiro **não transita pela conta do Wednest**; o Wednest apenas retém uma comissão de intermediação (percentual de plataforma) no momento da transação, via mecanismo de split de pagamento (marketplace) do próprio Mercado Pago;
- Tratamos, sobre essa transação: valor do presente, nome opcional informado pelo convidado, referência da transação, status do pagamento. Não coletamos e-mail, telefone, CPF ou qualquer outro dado do convidado que paga o presente;
- Para viabilizar o repasse direto ao casal, armazenamos as credenciais de acesso (tokens OAuth) da conta Mercado Pago conectada pelo próprio casal. Esses tokens são tratados como credenciais sensíveis de acesso a recursos financeiros de terceiro (o casal) e não são expostos a nenhum outro usuário da plataforma, incluindo outros membros do mesmo casamento, por meio da interface do produto.

Base legal para o dado do convidado (nome opcional): consentimento, fornecido no próprio ato de preenchimento voluntário do campo.

---

## 4. Com quem compartilhamos os dados (Operadores)

Não vendemos dados pessoais a terceiros, nem os utilizamos para publicidade de terceiros. Compartilhamos dados pessoais apenas com prestadores de serviço ("operadores", nos termos do art. 5º, VII, da LGPD) estritamente necessários para o funcionamento da plataforma:

| Operador | Função | Dados envolvidos |
|---|---|---|
| **Supabase** | Hospedagem do banco de dados, autenticação de usuários e armazenamento de arquivos/fotos | Todos os dados descritos nesta política, na medida em que trafegam pela infraestrutura de banco de dados/auth/storage |
| **Vercel** | Hospedagem da aplicação web (frontend e backend/API) | Dados trafegados nas requisições à aplicação |
| **Mercado Pago** | Processamento de pagamentos (assinaturas e presentes), incluindo dados de pagamento propriamente ditos, que ficam sob a responsabilidade e políticas do próprio Mercado Pago | Dados de pagamento, e-mail do pagador, valores das transações |
| **Cloudflare** (Turnstile) | Verificação anti-robô no cadastro | Sinal técnico de verificação (token), sem finalidade de rastreamento publicitário |

Podemos também compartilhar dados pessoais quando exigido por lei, ordem judicial ou requisição de autoridade competente, ou para proteger direitos, propriedade ou segurança do Wednest, de nossos usuários ou de terceiros.

---

## 5. Transferência internacional de dados

Os prestadores de serviço utilizados pelo Wednest (incluindo, potencialmente, infraestrutura de nuvem e serviços de pagamento) podem processar ou armazenar dados em servidores localizados fora do Brasil. Sempre que isso ocorrer, o tratamento observará as hipóteses e salvaguardas previstas nos arts. 33 a 36 da LGPD, buscando assegurar nível de proteção adequado aos dados pessoais transferidos (por exemplo, por meio de cláusulas contratuais padrão, mecanismos de certificação, ou tratamento pelo destinatário em país com nível de proteção reconhecido pela Autoridade Nacional de Proteção de Dados). Não afirmamos, nesta versão do documento, em qual país específico cada prestador armazena os dados, pois essa informação depende de configurações de infraestrutura que devem ser confirmadas operacionalmente antes da publicação final desta política.

---

## 6. Retenção e exclusão de dados

O Wednest adota um mecanismo de **exclusão em duas etapas**, alinhado ao princípio da necessidade e ao direito de eliminação previsto na LGPD (art. 18, VI):

1. **Exclusão lógica (soft delete):** ao solicitar a exclusão da conta (tela de Perfil), os dados do casamento são imediatamente marcados como excluídos e deixam de ficar acessíveis na interface do produto. Durante um período de **30 (trinta) dias corridos**, a conta pode ser reativada mediante contato com o suporte (não há, hoje, um fluxo de reativação self-service dentro do produto).
2. **Exclusão definitiva (expurgo):** decorridos os 30 dias sem reativação, um processo automatizado agendado remove definitivamente e em cadeia todos os dados vinculados à conta — perfil, casamento, convidados, lançamentos financeiros, checklist, arquivos e demais registros associados.

Importante: a exclusão automatizada remove os registros do banco de dados. **Arquivos e fotos eventualmente enviados para o armazenamento (documentos, fotos de galeria, fotos de presentes) devem ser removidos como parte desse mesmo processo de expurgo**; caso o usuário tenha dúvidas sobre a efetiva eliminação de um arquivo específico após o prazo de 30 dias, pode confirmar diretamente com o canal de atendimento (item 8).

Enquanto a conta estiver ativa, os dados são mantidos pelo tempo necessário à prestação do serviço contratado. Dados de pagamento/transação podem ser retidos por prazo adicional quando exigido por obrigação legal, fiscal ou regulatória (ex.: guarda de documentos fiscais e comprovação de transações financeiras), nos termos do art. 16 da LGPD.

---

## 7. Segurança da informação

Adotamos medidas técnicas e administrativas para proteger os dados pessoais tratados, incluindo:

- **Controle de acesso a nível de banco de dados (Row Level Security)**: cada operação de leitura e escrita é restrita, diretamente no banco de dados, ao próprio casamento e aos usuários autorizados a acessá-lo — não se trata apenas de uma verificação na camada de aplicação, mas de uma barreira imposta pelo próprio banco de dados;
- **Criptografia em trânsito** via HTTPS em toda a aplicação (hospedagem Vercel);
- **Limitação de taxa de requisições (rate limiting)** em rotas sensíveis (cadastro, login, recuperação de senha, checkout de pagamento, cancelamento de assinatura), para dificultar ataques automatizados e abuso;
- **Verificação de assinatura criptográfica (HMAC)** nas notificações (webhooks) recebidas do Mercado Pago, para impedir a falsificação de confirmações de pagamento;
- **CAPTCHA (Cloudflare Turnstile)** na tela de cadastro, para dificultar criação automatizada de contas;
- Senhas geridas exclusivamente pelo provedor de autenticação (Supabase Auth), nunca armazenadas em texto puro pelo Wednest.

**Não oferecemos, nesta versão do produto, autenticação em dois fatores (2FA).** Recomendamos aos usuários a adoção de senhas fortes e únicas.

Nenhum sistema é 100% imune a incidentes de segurança. Em caso de incidente que possa acarretar risco ou dano relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados, na forma do art. 48 da LGPD.

---

## 8. Direitos do titular de dados

Nos termos do art. 18 da LGPD, você, titular de dados pessoais, tem direito a solicitar, a qualquer momento e mediante requisição:

- **Confirmação** da existência de tratamento de seus dados;
- **Acesso** aos dados pessoais tratados;
- **Correção** de dados incompletos, inexatos ou desatualizados;
- **Anonimização, bloqueio ou eliminação** de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;
- **Portabilidade** dos dados a outro fornecedor de serviço, mediante requisição expressa;
- **Eliminação** dos dados tratados com base no consentimento, ressalvadas as hipóteses de guarda obrigatória previstas em lei;
- **Informação** sobre entidades públicas e privadas com as quais o controlador realizou uso compartilhado de dados;
- **Informação** sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;
- **Revogação do consentimento**, quando o tratamento se basear nessa hipótese;
- **Oposição** a tratamento realizado com base em hipótese legal que não a de consentimento, em caso de descumprimento à LGPD.

Hoje, o Wednest já oferece, de forma self-service dentro do produto: exportação da lista de convidados em formato de planilha (CSV) e exclusão da própria conta (tela de Perfil). Para os demais direitos listados acima (acesso integral aos dados do casamento, correção, portabilidade completa, oposição, esclarecimentos), entre em contato pelo canal:

📧 `[E-MAIL DO ENCARREGADO/PRIVACIDADE — PREENCHER]`

Responderemos às solicitações dentro dos prazos legais aplicáveis. Podemos solicitar informações adicionais para confirmar sua identidade antes de atender à solicitação, como forma de proteger os dados de terceiros e evitar fraudes.

Convidados de um casamento que desejem exercer direitos sobre seus próprios dados (inseridos pelo casal) devem, preferencialmente, contatar diretamente o casal responsável pelo cadastro; o canal acima também está disponível para intermediar esse contato quando necessário.

---

## 9. Menores de idade

O Wednest é um produto destinado ao planejamento de casamentos e, por sua própria natureza, não é direcionado a menores de 18 (dezoito) anos. **Não realizamos, hoje, verificação de idade no momento do cadastro.** Ao criar uma conta, o usuário declara e garante ser maior de idade e plenamente capaz nos termos da legislação civil brasileira, sendo o único responsável por eventuais informações falsas prestadas nesse sentido. Caso tomemos conhecimento de que uma conta pertence a pessoa menor de idade, poderemos suspendê-la e excluir os dados associados, sem prejuízo de outras medidas cabíveis.

---

## 10. Cookies

O uso de cookies pelo Wednest é tratado em documento específico: a [Política de Cookies](./politica-de-cookies.md).

---

## 11. Alterações desta política

Esta Política de Privacidade pode ser atualizada a qualquer momento, para refletir mudanças no produto, na legislação aplicável ou em nossas práticas de tratamento de dados. Alterações relevantes serão comunicadas com destaque, e a data de "última atualização" no topo deste documento será sempre revisada.

---

## 12. Legislação aplicável e foro

Esta Política de Privacidade é regida pelas leis da República Federativa do Brasil, em especial a LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014). Fica eleito o foro indicado nos Termos de Uso para dirimir eventuais controvérsias, ressalvado o foro do domicílio do consumidor, quando aplicável por força do Código de Defesa do Consumidor.
