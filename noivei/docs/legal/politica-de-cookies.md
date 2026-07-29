# Política de Cookies — Wednest

**Última atualização:** 05 de agosto de 2027

---

## 1. O que são cookies

Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site ou usa uma aplicação web. Eles permitem que o site reconheça seu dispositivo, mantenha você conectado, e ofereça funcionalidades básicas de navegação.

---

## 2. Levantamento real dos cookies usados pelo Wednest

Diferentemente de boa parte dos sites que combinam cookies essenciais com cookies de análise de audiência (analytics) e de publicidade (marketing), o Wednest, **nesta data**, utiliza apenas cookies **estritamente necessários ao funcionamento do serviço**. Não há, em produção, nenhuma ferramenta de análise de audiência (como Google Analytics), pixel de redes sociais (como Meta/Facebook Pixel) ou ferramenta de product analytics (como PostHog, Mixpanel ou similares) em operação. Essa constatação decorre de auditoria técnica do código-fonte da aplicação, não de mera declaração de política.

Os únicos cookies/tecnologias de armazenamento local em uso hoje são:

### 2.1. Cookie de sessão (Supabase Auth) — essencial

| Característica | Detalhe |
|---|---|
| Finalidade | Manter você autenticado(a) na sua conta Wednest entre uma página e outra, sem precisar digitar login e senha a cada acesso |
| Fornecedor | Supabase (infraestrutura de autenticação usada pelo Wednest) |
| Natureza | Estritamente necessário — sem ele, o produto não funciona (não é possível manter uma sessão logada) |
| Configuração técnica | `Secure` (só trafega em conexão HTTPS) e `SameSite=Lax` (mitigação contra CSRF/vazamento entre sites) |
| Observação sobre HttpOnly | Por uma limitação técnica da biblioteca de integração utilizada (`@supabase/ssr`), esse cookie não pode ser marcado como `HttpOnly` no lado do navegador, pois o próprio client-side da aplicação precisa ler/gerenciar o token de sessão para funcionar corretamente. Isso não altera sua natureza de cookie estritamente necessário — apenas descreve uma característica técnica da implementação |
| Duração | Vinculada à duração da sessão de autenticação |
| Exige consentimento? | **Não.** Enquadra-se na exceção de cookies estritamente necessários (ver seção 4) |

### 2.2. Cookie/armazenamento local do Cloudflare Turnstile — necessário/funcional

| Característica | Detalhe |
|---|---|
| Finalidade | Verificação de que quem está criando uma conta é um ser humano, e não um robô/script automatizado (proteção antifraude no cadastro) |
| Fornecedor | Cloudflare (widget "Turnstile", carregado a partir do domínio `challenges.cloudflare.com`) |
| Natureza | Necessário/funcional — não tem finalidade de rastreamento publicitário ou perfilamento comportamental; existe exclusivamente para viabilizar a checagem anti-robô no formulário de cadastro |
| Exige consentimento? | Tratado como cookie necessário/funcional (mesmo enquadramento dado por diversas soluções equivalentes de CAPTCHA), pois sua finalidade exclusiva é de segurança, não de marketing (ver seção 4) |

**Não existem, hoje, cookies de:**
- Análise de audiência/estatística (analytics);
- Publicidade ou remarketing (marketing);
- Redes sociais para fins de rastreamento entre sites;
- Perfilamento comportamental para fins comerciais.

---

## 3. Compromisso de atualização

Caso o Wednest venha, no futuro, a adotar ferramentas de análise de audiência, marketing ou qualquer outra tecnologia de rastreamento que dependa de cookies não essenciais, **esta Política de Cookies será atualizada antes da ativação dessas ferramentas**, com a devida solicitação de consentimento prévio, livre, informado e inequívoco do usuário, por meio do banner e da central de preferências de cookies (ver documento [Banner e Central de Preferências de Cookies](./banner-e-preferencias-de-cookies.md)), em conformidade com a LGPD e com as diretrizes da Autoridade Nacional de Proteção de Dados (ANPD) sobre a matéria.

---

## 4. Quais cookies exigem consentimento, e por quê

A LGPD não trata "cookies" como uma categoria autônoma e específica de dado — o tratamento de cookies se enquadra nas regras gerais de tratamento de dados pessoais (quando o cookie, direta ou indiretamente, permite identificar uma pessoa ou seu dispositivo). Tomando por base a prática regulatória já consolidada em outras jurisdições (como o ePrivacy da União Europeia, usado como referência comparada por boa parte da doutrina brasileira de proteção de dados, na ausência de regulação específica de cookies pela ANPD) e os princípios da LGPD (art. 6º) de necessidade, adequação e boa-fé, a análise de cada cookie usado pelo Wednest é a seguinte:

- **Cookie de sessão do Supabase Auth: dispensa consentimento específico.** Ele é estritamente necessário para a prestação do serviço solicitado ativamente pelo usuário (permanecer logado na própria conta) — sem ele, a funcionalidade básica da aplicação (autenticação) simplesmente não existe. Cookies dessa natureza são tradicionalmente equiparados à hipótese de execução de contrato (art. 7º, V, da LGPD): o tratamento é necessário para cumprir a própria função que o titular pediu ao usar o produto, dispensando um consentimento em separado (o que não dispensa transparência, daí a existência desta política e do banner informativo).
- **Cookie/armazenamento do Cloudflare Turnstile: tratado como necessário/funcional, também sem exigência de consentimento prévio como condição de uso.** Sua finalidade é exclusivamente de segurança (impedir criação automatizada de contas), constituindo hipótese de legítimo interesse do controlador na proteção da própria plataforma e de seus usuários contra fraude e abuso (art. 7º, IX, da LGPD), de forma semelhante a soluções equivalentes de CAPTCHA amplamente adotadas no mercado. Não se destina a rastreamento entre sites nem a perfilamento comercial.
- **Cookies de analytics/marketing:** **não existem atualmente**. Caso venham a existir, exigirão consentimento prévio, específico, informado e revogável a qualquer momento, coletado antes da ativação de qualquer script de rastreamento não essencial — nunca de forma pré-marcada ("opt-out"), sempre por ação afirmativa do usuário ("opt-in").

Ainda que os dois cookies hoje existentes dispensem consentimento prévio como condição para o uso do site, o Wednest exibe um banner informativo de transparência (ver documento anexo) — não porque a lei exija consentimento para esses cookies específicos, mas como boa prática de transparência e para já deixar preparada a estrutura de preferências, caso cookies não essenciais venham a ser adicionados no futuro.

---

## 5. Como gerenciar cookies no seu navegador

Você pode, a qualquer momento, gerenciar ou bloquear cookies diretamente nas configurações do seu navegador. Note que bloquear o cookie de sessão do Supabase Auth impedirá o funcionamento do login e das funcionalidades que exigem estar autenticado. Consulte a documentação do seu navegador (Chrome, Firefox, Safari, Edge etc.) para instruções específicas de gerenciamento de cookies.

---

## 6. Mais informações

Para entender como tratamos os dados pessoais coletados de forma geral (não apenas via cookies), consulte a [Política de Privacidade](./politica-de-privacidade.md). Dúvidas sobre esta Política de Cookies podem ser encaminhadas para wednest.suport@gmail.com.
