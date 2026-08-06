# Wednest

Wednest é um SaaS de planejamento de casamento. O casal cria uma conta, cadastra o
casamento e usa um painel com vários módulos para organizar o evento; convidados
interagem com uma parte pública (site do casal e confirmação de presença) sem
precisar criar conta.

## O que o sistema faz

### Painel do casal (área autenticada)

- **Checklist & Timeline** — lista de tarefas por fase do planejamento, com prazos,
  categorias e itens sugeridos automaticamente a partir das respostas do onboarding.
- **Convidados & RSVP** — cadastro de convidados (individual ou importação em CSV),
  quantidade de pessoas por convite ("família inteira"), envio de convite por
  WhatsApp e confirmação de presença pública por link único (`/rsvp/[token]`), com
  conferência do telefone informado contra o cadastrado pelo casal.
- **Financeiro** — lançamentos de gastos por categoria e fornecedor, parcelamento de
  pagamentos, cotações de fornecedores (Premium), e meta de gastos por categoria com
  alerta visual quando o comprometido ultrapassa o combinado (Premium).
- **Mesas** — organização de convidados em mesas, com arrastar-e-soltar (desktop) ou
  seletor (mobile/touch).
- **Site do casal** — página pública personalizável (`/[slug]`) com história do
  casal, galeria de fotos, informações de cerimônia/festa e lista de presentes.
- **Central de arquivos** — upload de arquivos e documentos do casamento (contratos,
  orçamentos etc.), com cota de armazenamento por plano.
- **Lista de presentes** — itens com link de loja externa ou, alternativamente,
  presente pago pelo convidado direto pelo app: o dinheiro cai na conta do próprio
  casal via split de pagamento do Mercado Pago (o casal conecta a própria conta em
  Presentes), com uma comissão da plataforma configurável pelo admin.
- **Padrinhos & Entradas** — organização do cortejo (papel, par de entrada, quem leva
  as alianças) a partir dos convidados já confirmados.
- **Contas sincronizadas** — o dono do casamento pode convidar outras pessoas
  (cerimonialista, familiares etc.) para colaborar, com permissão configurável por
  módulo.
- **Planos e cobrança** — Gratuito, Ideal e Exclusivo (nome real em `plans.name`;
  `plan_id` interno continua `premium_*`/`premium_plus_*`, só o nome exibido mudou),
  com limites de convidados/armazenamento/entradas e módulos liberados por plano
  (ambos configuráveis pelo admin, sem deploy — ver tabela abaixo). Cobrança
  recorrente ou única via Mercado Pago, com cupom de desconto (percentual, fixo ou
  dias grátis) e cancelamento de assinatura
  pelo próprio casal.

#### Diferença real entre os planos

Valores extraídos diretamente de `plan_limits`/`plan_module_access` (não da vitrine
de marketing) — são os números que o produto de fato aplica hoje. Preço e nomes
exatos, catálogo completo de recursos numéricos e liberação de módulo são sempre
editáveis sem deploy em `/admin/planos` e `/admin/planos/modulos`; a tabela abaixo
reflete a configuração de fábrica (seed das migrations), que pode já ter sido
alterada pelo admin.

| Recurso | Gratuito | Ideal | Exclusivo |
|---|---|---|---|
| Preço | R$ 0 | R$ 19,90/mês ou R$ 97 único | R$ 34,90/mês ou R$ 197 único |
| Convidados | até 100 | até 500 | até 999 |
| Colaboradores (contas sincronizadas) | 1 (só o dono) | até 5 | até 10 |
| Armazenamento (Central de Arquivos) | 100 MB | 5 GB | 20 GB |
| Lançamentos financeiros | até 15 | ilimitado | ilimitado |
| Cotação de fornecedores / meta de gastos por categoria (Financeiro) | ❌ | ✅ | ✅ |
| Padrinhos/madrinhas cadastráveis | até 2 | ilimitado | ilimitado |
| Checklist, Timeline, Convidados, Padrinhos | ✅ | ✅ | ✅ |
| Site do casal (`/[slug]`), Lista de presentes, Mesas | ❌ | ✅ | ✅ |
| Estilo de site "Portfólio" (alternativa ao Clássico) | ❌ | ❌ | ✅¹ |
| Álbum de fotos (mural via QR code) | ❌ | ❌ | ✅¹ |
| Check-in no dia (Portaria/QR) | ❌ | ❌ | ✅¹ |
| Wedding Score | ❌ | ✅ | ✅ |
| Exportação completa de dados (LGPD) | ✅ | ✅ | ✅ |

¹ Módulo opt-in: por padrão de fábrica só o plano ativo mais caro o recebe
(`premium_plus_once`, especificamente — não o `premium_plus_monthly` — a menos que
o admin libere manualmente para outros planos em `/admin/planos/modulos`).

Recursos que aparecem na vitrine de marketing (`plan_feature_*`, editável em
`/admin/planos`) mas que **não têm implementação correspondente no código hoje** —
revisar antes de anunciar como diferencial real: sugestões/assistente de IA
(nenhum código de IA está em produção — `src/lib/ai/` é reservado pra uma fase
futura), backup automático/avançado, notificações push, exportação em Excel (a
exportação real é um PDF completo por categoria, disponível pra qualquer plano,
restrita ao dono do casamento — não uma distinção paga), e "distribuição
automática" de mesas (a organização de mesas é manual, por arrastar-e-soltar ou
seletor).

### Área pública (sem login)

- Site do casal (`/[slug]`), com conteúdo publicado voluntariamente pelo casal —
  inclui pagamento de presente pelo app (convidado anônimo, não cria conta).
- Confirmação de presença (`/rsvp/[token]`) — o convidado não cria conta; o link
  único por convidado é a credencial de acesso.
- Aceite de convite de colaboração (`/convite/[token]`).
- Termos de Uso (`/termos`) e Política de Privacidade + Cookies (`/privacidade`) —
  conteúdo real em [`docs/legal/`](./docs/legal/) (ver aviso de rascunho no início
  de cada documento — precisa de revisão jurídica antes de qualquer mudança
  substancial de conteúdo).

### Painel administrativo (`/admin/**`, restrito a `profiles.role = 'admin'`)

- **Planos & limites** — catálogo de planos (preço, cobrança única/recorrente,
  destaque) e limites numéricos por plano (convidados, armazenamento etc.), tudo
  editável sem deploy.
- **Módulos por plano** — matriz que define quais módulos (checklist, convidados,
  financeiro, mesas, site, arquivos, presentes, padrinhos, checkin, album) cada
  plano libera de verdade — não é só a vitrine de comparação, é o controle de
  acesso em si. `checkin` e `album` são opt-in por natureza: nunca liberados
  automaticamente por preço, mesmo em plano pago (ver seed em
  `supabase/migrations/20260801000001_add-checkin-module.sql` e
  `20260803000001_add-album-module.sql`).
- **Tabela de comparação** — o conteúdo de marketing exibido lado a lado em
  `/perfil/planos`. É texto livre editável pelo admin, então pode divergir do que
  o código de fato aplica — ver a ressalva na seção "Diferença real entre os
  planos" acima antes de tratar essa tabela como fonte da verdade.
- **Cupons** — percentual, valor fixo ou dias grátis de um plano.
- **Configurações** — parâmetros globais: comissão da plataforma sobre presente
  pago pelo app (0–10%) e prazo de expurgo definitivo de conta após exclusão
  (padrão 30 dias, configurável entre 7 e 365).
- **Usuários** — listagem/gestão de contas.

## Stack técnica

- **Next.js 16** (App Router) + **TypeScript** estrito
- **Supabase**: Postgres, Auth, Storage, Row Level Security
- **Tailwind CSS v4**, **Zod**, **Zustand**, **TanStack Query**
- E-mail transacional via SMTP próprio (nodemailer), independente do Supabase Auth
- **Mercado Pago** — cobrança de assinatura (Preference/Preapproval, token da
  própria Wednest) e presente de convidado via marketplace/split (OAuth: cada casal
  conecta a própria conta, o dinheiro cai direto nela, a Wednest retém só a
  comissão configurada em `/admin/configuracoes`)
- **Cloudflare Turnstile** — CAPTCHA no cadastro, login e recuperação de senha
- Vercel Cron para rotinas agendadas (aviso de tarefa atrasada, marcos do
  casamento, exclusão automática após o casamento, expurgo definitivo de conta)
  — ver `vercel.json`
- Nenhuma ferramenta de analytics/rastreamento de terceiros está ativa no código atual

---

## Dados pessoais tratados (referência para análise de LGPD)

Esta seção descreve, com base no código e no schema do banco, **quais dados
pessoais o sistema efetivamente coleta, de quem, para quê e onde ficam** — para
apoiar uma análise jurídica (política de privacidade, RIPD, contratos com
subprocessadores). Não substitui a política de privacidade voltada ao usuário
final, que deve ser redigida pelo jurídico a partir destas informações.

### Quem são os titulares de dados

1. **Dono da conta** (quem se cadastra e paga o plano)
2. **Membros convidados** para colaborar no mesmo casamento (contas sincronizadas)
3. **Convidados do casamento** (pessoas cadastradas pelo casal para receber RSVP)
4. **Visitantes do site público** — não deixam dado nenhum só de visualizar a página

### Dados coletados por titular

**Dono da conta / membros colaboradores**
| Dado | Onde fica | Finalidade |
|---|---|---|
| E-mail e senha (hash) | Supabase Auth (`auth.users`) — gerenciado pelo próprio Supabase, o app nunca vê a senha em texto puro | Login/autenticação |
| Nome completo, foto de perfil | tabela `profiles` | Identificação dentro do painel |
| Preferências de notificação (ligar/desligar e-mails de timeline/RSVP) | tabela `profiles` | Personalização de notificações |
| Nome do casal, data/local do casamento, orçamento, estilo, cor escolhida | tabela `weddings` | Funcionamento do produto (checklist, financeiro, site) |
| Vínculo de colaboração (quem tem acesso a qual casamento e com quais permissões por módulo) | tabelas `wedding_members`/`wedding_invites` | Contas sincronizadas |

**Convidados do casamento** (inseridos pelo casal, não se cadastram sozinhos)
| Dado | Onde fica | Finalidade |
|---|---|---|
| Nome, grupo/família, e-mail, telefone | tabela `guests` | Convite e confirmação de presença (RSVP) |
| Quantidade de pessoas do convite / confirmadas | tabela `guests` | Controle de RSVP e mesas |
| Status de confirmação (pendente/confirmado/recusado) | tabela `guests` | RSVP |
| Telefone informado no RSVP | comparado no servidor contra o telefone cadastrado, **nunca é devolvido ao público** — usado só para conferir identidade de quem responde | Evitar que um link de RSVP vazado/reencaminhado seja respondido por outra pessoa |
| Nome de quem presenteou (se o casal registrar manualmente) | tabela `gift_registry_items` | Organização da lista de presentes |

**Fotos e arquivos enviados pelo casal**
- Fotos da galeria do site e foto de capa (bucket de Storage público, pois ilustram
  o site público) e arquivos da Central de Arquivos (bucket privado) — conteúdo
  livre definido pelo casal, que pode incluir imagens de pessoas identificáveis
  (o próprio casal, convidados, família) e documentos com dados de terceiros
  (ex.: contrato com fornecedor). O sistema não analisa nem classifica esse
  conteúdo.

**O que o sistema NÃO coleta hoje**
- Dado de cartão/pagamento em si: o Mercado Pago processa o pagamento (assinatura
  e presente); a Wednest nunca recebe nem armazena número de cartão — só
  recebe de volta status (aprovado/pendente/recusado) e um id de referência.
- CPF, documentos de identidade, dados de saúde, biometria.
- Cookies de rastreamento ou ferramentas de analytics de terceiros.
- Localização/geolocalização.

### Terceiros que processam dados (subprocessadores)

- **Supabase** — hospeda banco de dados, autenticação e armazenamento de arquivos.
  Confirmar com quem administra o projeto Supabase a região de hospedagem dos
  dados para a análise de transferência internacional.
- **Mercado Pago** — processa pagamento de assinatura e de presente de convidado.
  No presente (Fase 2), o dinheiro cai direto na conta do CASAL (não da Wednest),
  via split/marketplace com OAuth — a Wednest só recebe a própria comissão.
- **Cloudflare** (Turnstile) — verificação anti-bot no cadastro/login/recuperação
  de senha.
- **Provedor de SMTP** (ex.: Gmail/Workspace, configurado via variáveis de
  ambiente) — envia e-mails transacionais (confirmação de RSVP, avisos de tarefa
  atrasada etc.) para o e-mail do casal/convidado.

Documentos legais completos (Política de Privacidade, Política de Cookies, Termos
de Uso), publicados em `/privacidade` e `/termos`, estão em
[`docs/legal/`](./docs/legal/) — redigidos a partir da análise real do código,
ainda pendentes de razão social/CNPJ (empresa não formalizada) e de revisão
jurídica antes de qualquer mudança substancial de conteúdo.

O texto do **banner de cookies e da central de preferências** também já está
redigido (`docs/legal/banner-e-preferencias-de-cookies.md`), mas só o texto —
o componente de verdade (o aviso que aparece no site, guarda a escolha do
usuário etc.) ainda não foi implementado. Como hoje só há cookies estritamente
necessários (ver acima), isso não é obrigatório por lei — vira obrigatório se
uma ferramenta de analytics/marketing for adicionada no futuro.

### Segurança técnica relevante

- **Row Level Security (RLS)** ativo em toda tabela com dado de casamento/usuário —
  é a principal barreira de acesso, não só uma camada extra: várias operações vão
  direto do navegador ao banco.
- **Controle de acesso por módulo**: o dono decide quais módulos cada colaborador
  convidado pode ver/editar, e qual plano libera cada módulo (ver Painel administrativo).
- Upload de arquivo com **lista de tipos permitidos (MIME)** e conferência do
  tamanho real gravado no Storage (não confia em valor enviado pelo navegador).
- Rotas públicas (RSVP, aceite de convite, site) usam acesso de serviço restrito a
  funções dedicadas que só expõem os campos estritamente necessários — nunca
  telefone/e-mail de convidado, por exemplo.
- **CAPTCHA (Cloudflare Turnstile)** no cadastro, login e recuperação de senha —
  proteção contra criação de conta em massa e automação de login.
- **Rate limiting** por IP/usuário nas rotas sensíveis (login, cadastro, checkout,
  cupom, exportação de dados, ações administrativas etc.), com bloqueio temporário
  após excesso de tentativas.
- Auditoria de segurança conduzida em 2026-07 (RLS, autorização, injeção/upload,
  API/dependências) — achados corrigidos incluem: policy de `subscriptions` que
  permitia auto-concessão de plano pago (fechada, agora só o plano gratuito é
  gravável direto pelo cliente), conexão da conta Mercado Pago de presentes restrita
  ao dono/full_access, dependências desatualizadas, e mais — ver histórico de commits
  `security(api)`/`security(lgpd)` para o detalhe de cada correção.

### Retenção e exclusão

- **Exclusão automática após o casamento**: independente de o casal pedir ou não,
  a rota agendada `/api/cron/auto-delete-after-wedding` (Vercel Cron, diária)
  marca o casamento pra exclusão (mesmo soft delete de sempre) quando o prazo do
  plano ativo se esgota, contado a partir de `weddings.wedding_date` —
  `plan_limits.retention_days_after_wedding`: 30 dias no Gratuito, 365 dias nos
  planos pagos (Ideal e Exclusivo, mensal ou pagamento único). Editável sem
  deploy em `/admin/planos`. A partir daí, segue o mesmo fluxo abaixo.
- Exclusão de conta (pedida pelo casal, ou automática acima) é **soft delete**
  (`weddings.deleted_at`): os dados somem do
  produto na hora, mas ficam recuperáveis por um prazo mediante contato com o
  suporte — hoje 30 dias por padrão, configurável em `/admin/configuracoes`
  (`app_settings.account_purge_days`, entre 7 e 365 dias).
- Depois desse prazo, a rota agendada `/api/cron/purge-accounts` (Vercel Cron,
  diária) primeiro apaga os **arquivos de verdade no Storage** de todos os buckets
  do casamento (fotos de capa/galeria, arquivos da Central de Arquivos, fotos de
  presente e fotos do álbum/mural — `storage.objects` não tem cascade com as
  tabelas da aplicação, então isso precisa ser feito à parte) e só depois chama
  `fn_purge_soft_deleted_accounts()` pra apagar o usuário em `auth.users`; como
  toda tabela do casamento referencia essa conta em cascata (`ON DELETE CASCADE`),
  o restante (checklist, convidados, financeiro, site, lista de presentes etc.) é
  apagado automaticamente. Substituiu o agendamento antigo via `pg_cron` puro, que
  não limpava o Storage (achado da revisão jurídica de 2026-07).

### Direitos do titular já suportados hoje

- **Exclusão** — botão de exclusão de conta no painel, com o aviso de que os dados
  do casamento atual serão apagados (ver acima).
- **Exportação** — botão "Exportar meus dados" no perfil baixa um **PDF completo**
  (uma tabela por categoria) com todos os dados pessoais do casamento (perfil,
  assinatura, convidados, checklist, financeiro, presentes, padrinhos, mesas,
  site, metadados de arquivos/fotos, preferências, membros e convites) — não só
  a lista de convidados como antes. Restrito ao dono literal do casamento (não a
  membro convidado, mesmo com acesso completo) — decisão de produto, já que só
  o dono é o Controlador dos Dados identificado na Política de Privacidade;
  membro convidado pode solicitar os próprios dados pelo canal de suporte.
- Não há hoje uma tela de autoatendimento para o **convidado** (titular externo,
  sem conta) solicitar correção/exclusão dos próprios dados — esse pedido precisa
  passar pelo casal (que é quem cadastrou o dado) ou pelo suporte.

---

## Rodando o projeto localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Variáveis de ambiente
necessárias (sem prefixo `NEXT_PUBLIC_` ficam só no servidor):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=

# E-mail transacional (opcional em dev — sem isso, e-mails só são logados no console)
EMAIL_SMTP_HOST=
EMAIL_SMTP_PORT=
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
EMAIL_FROM=

# Autenticação das rotas de cron (aviso de tarefa atrasada, expurgo de conta —
# ver vercel.json). A Vercel já envia esse valor sozinha em cron nativo dela.
CRON_SECRET=

# Mercado Pago — assinatura (token da própria Wednest) e webhook de pagamento
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
# Mercado Pago — OAuth/marketplace (presente de convidado direto na conta do casal)
MERCADOPAGO_CLIENT_ID=
MERCADOPAGO_CLIENT_SECRET=

# Cloudflare Turnstile — CAPTCHA no cadastro/login/recuperação de senha
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
# (o Secret Key correspondente é configurado no painel do Supabase, em
# Authentication > Attack Protection — não é uma env var deste projeto)
```

### Migrations

Não há CLI/CI de migration configurado — cada arquivo em `supabase/migrations/`
(nomeado `YYYYMMDDHHMMSS_descricao.sql`, sempre append-only, nunca editado depois
de criado) precisa ser aplicado manualmente, na ordem dos arquivos, colando o SQL
no **SQL Editor** do painel do Supabase do projeto (produção e qualquer ambiente
de teste/staging que você use).

### Acessar o painel administrativo localmente

O painel (`/admin/**`) é liberado por `profiles.role = 'admin'` — não tem nenhuma
tela de "virar admin", é preciso rodar isto uma vez no SQL Editor do Supabase,
com o seu próprio `id` de usuário (visível em Authentication > Users no painel):

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<seu-user-id>';
```

### Testes

```bash
npm run test        # roda a suíte (Vitest) uma vez
npm run test:watch  # modo watch
npm run validate    # type-check + lint + test, tudo junto (recomendado antes de commitar)
```

## Documentação adicional

- [`CLAUDE.md`](./CLAUDE.md) — convenções de código, estrutura de pastas e
  padrões de banco de dados.
- [`docs/checklist-rule-engine.md`](./docs/checklist-rule-engine.md) — design do
  motor de regras que gera o Checklist/Timeline personalizado a partir das
  respostas do onboarding (perguntas, categorias de tarefa, regras de prazo).
- [`docs/legal/`](./docs/legal/) — Política de Privacidade, Política de Cookies,
  Termos de Uso e texto do banner de cookies (ver seção "Dados pessoais
  tratados" acima para o status de cada um).
