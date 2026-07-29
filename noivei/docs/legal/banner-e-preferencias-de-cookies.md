# Banner e Central de Preferências de Cookies — Wednest

> ⚠️ **Aviso importante:** este é um **rascunho gerado com apoio de IA**, produzido a partir da leitura direta do código-fonte do sistema Wednest para identificar exatamente quais cookies estão em uso hoje. Ele **não substitui a revisão de um(a) advogado(a) habilitado(a)** antes da publicação. Este documento traz apenas o **texto e a estrutura de conteúdo** sugeridos para o banner e a central de preferências — a implementação visual/técnica (componente React, persistência da escolha do usuário etc.) não foi criada por esta tarefa, apenas o conteúdo textual.

---

## 1. Contexto e racional de design

Como confirmado na auditoria técnica do código-fonte (ver [Política de Cookies](./politica-de-cookies.md)), o Wednest usa hoje **apenas dois cookies/tecnologias, ambos estritamente necessários ou funcionais**: o cookie de sessão do Supabase Auth e o verificador anti-robô Cloudflare Turnstile. Não há cookies de analytics ou marketing em produção.

Por isso, o banner recomendado abaixo é **deliberadamente mais simples** do que o banner de um site que usa cookies de rastreamento não essenciais (que exigiria, por lei, coleta de consentimento explícito antes de carregar esses scripts, com opção real de recusa). Ainda assim, recomendamos manter o banner por **transparência** com o usuário e para já deixar pronta a estrutura de categorias, category toggles e central de preferências — caso o Wednest venha a adicionar, no futuro, cookies de analytics/marketing, a estrutura abaixo já suporta a extensão sem redesenho.

---

## 2. Texto do banner de cookies

Banner simples, exibido na primeira visita (ou enquanto não houver uma escolha registrada), com um único botão de ação principal e um link secundário para a central de preferências.

### Copy sugerida

**Título (opcional, se o layout do banner tiver espaço):**
> Cookies no Wednest

**Corpo do texto:**
> Usamos apenas os cookies essenciais para você conseguir entrar na sua conta e para proteger o cadastro contra robôs. Não usamos cookies de publicidade ou de análise de navegação. [Saiba mais](/politica-de-cookies).

**Botões:**
- Botão primário (destaque): **Entendi**
- Link secundário (texto ou botão discreto): **Preferências de cookies**

### Variante alternativa (com botão "Aceitar", conforme solicitado)

> Usamos cookies essenciais para manter você conectado com segurança e proteger o cadastro contra robôs. Não usamos cookies de publicidade nem de análise de navegação hoje. [Saiba mais](/politica-de-cookies)

- Botão primário: **Aceitar**
- Link secundário: **Preferências**

### Notas de implementação (conteúdo, não código)

- Como os únicos cookies existentes são estritamente necessários/funcionais, o botão "Aceitar" **não bloqueia nem libera nenhum script adicional** — ele apenas registra que o usuário viu o aviso, para não exibi-lo novamente. Isso deve ficar claro internamente para quem implementar o componente: diferente de um banner com cookies de marketing, aqui não há um "if aceitou, carrega o script de tracking" — os cookies essenciais já operam independentemente da escolha do banner, pois são indispensáveis ao funcionamento do login.
- O link "Saiba mais"/"Preferências" deve levar à central de preferências (seção 3) ou à Política de Cookies completa.
- O banner não deve reaparecer a cada página após a primeira interação do usuário (registrar a escolha, por exemplo, em `localStorage` ou cookie próprio de preferência).

---

## 3. Texto da Central de Preferências de Cookies

Tela (modal ou página) acessível a partir do link "Preferências de cookies" do banner, do rodapé do site e da Política de Cookies. Estruturada por categorias, já preparada para receber categorias hoje inexistentes (analíticos, marketing), sinalizadas como indisponíveis.

### Título
> Preferências de cookies

### Texto introdutório
> Veja abaixo os cookies que usamos no Wednest e para que servem. Hoje, usamos apenas cookies essenciais e de segurança — não usamos cookies de análise de navegação nem de publicidade. Se isso mudar no futuro, você poderá ajustar suas preferências aqui.

### Categoria 1 — Cookies essenciais

- **Estado do toggle:** sempre ativado, sem opção de desativar (toggle bloqueado/desabilitado, com indicação visual de "sempre ativo")
- **Descrição:**
  > Necessários para você entrar e permanecer conectado(a) à sua conta, e para proteger o cadastro contra robôs. Sem estes cookies, o Wednest não funciona. Por serem estritamente necessários à prestação do serviço que você solicitou, não podem ser desativados.
- **Cookies incluídos nesta categoria:**
  - Cookie de sessão (Supabase Auth) — mantém você conectado(a)
  - Verificador anti-robô (Cloudflare Turnstile) — protege o cadastro contra criação automatizada de contas

### Categoria 2 — Cookies analíticos

- **Estado do toggle:** desativado, indisponível (toggle desabilitado/cinza)
- **Descrição:**
  > **Não utilizados atualmente.** Cookies analíticos nos ajudariam a entender como você usa o Wednest, para melhorar o produto (ex.: quais páginas são mais acessadas). Não usamos nenhuma ferramenta desse tipo hoje. Caso venhamos a usar no futuro, esta categoria será ativada aqui, e pediremos sua autorização antes de qualquer coleta.

### Categoria 3 — Cookies de marketing/publicidade

- **Estado do toggle:** desativado, indisponível (toggle desabilitado/cinza)
- **Descrição:**
  > **Não utilizados atualmente.** Cookies de marketing serviriam para personalizar anúncios ou medir campanhas em outros sites. Não usamos nenhuma ferramenta desse tipo hoje. Caso venhamos a usar no futuro, esta categoria será ativada aqui, e pediremos sua autorização antes de qualquer coleta.

### Rodapé da tela

- Botão primário: **Salvar preferências**
- Link: **Ver Política de Cookies completa** → `/politica-de-cookies`

---

## 4. Resumo de exigência de consentimento (referência rápida)

| Categoria | Em uso hoje? | Toggle | Exige consentimento prévio? |
|---|---|---|---|
| Essenciais (sessão Supabase + Turnstile) | Sim | Sempre ativo, sem opção de desligar | Não — estritamente necessários (ver fundamentação na Política de Cookies, item 4) |
| Analíticos | Não | Desativado/indisponível, com nota explicativa | Não se aplica hoje; exigirá opt-in explícito se for ativado no futuro |
| Marketing/publicidade | Não | Desativado/indisponível, com nota explicativa | Não se aplica hoje; exigirá opt-in explícito se for ativado no futuro |
