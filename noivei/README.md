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
- **Planos e cobrança** — Gratuito, Premium e Premium Plus, com limites de
  convidados/armazenamento/entradas e módulos liberados por plano (ambos
  configuráveis pelo admin, sem deploy). Cobrança recorrente ou única via Mercado
  Pago, com cupom de desconto (percentual, fixo ou dias grátis) e cancelamento de
  assinatura pelo próprio casal.

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
  financeiro, mesas, site, arquivos, presentes, padrinhos) cada plano libera de
  verdade — não é só a vitrine de comparação, é o controle de acesso em si.
- **Tabela de comparação** — o conteúdo de marketing exibido lado a lado em
  `/perfil/planos`.
- **Cupons** — percentual, valor fixo ou dias grátis de um plano.
- **Configurações** — parâmetros globais, hoje a comissão da plataforma sobre
  presente pago pelo app (0–10%).
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
- Vercel Cron para rotinas agendadas (aviso de tarefa atrasada, expurgo definitivo
  de conta) — ver `vercel.json`
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
mas ainda como **rascunho pendente de revisão jurídica e de preenchimento dos
dados da empresa** (ver aviso no início de cada arquivo).

### Segurança técnica relevante

- **Row Level Security (RLS)** ativo em toda tabela com dado de casamento/usuário —
  é a principal barreira de acesso, não só uma camada extra: várias operações vão
  direto do navegador ao banco.
- **Controle de acesso por módulo**: o dono decide quais módulos cada colaborador
  convidado pode ver/editar.
- Upload de arquivo com **lista de tipos permitidos (MIME)** e conferência do
  tamanho real gravado no Storage (não confia em valor enviado pelo navegador).
- Rotas públicas (RSVP, aceite de convite, site) usam acesso de serviço restrito a
  funções dedicadas que só expõem os campos estritamente necessários — nunca
  telefone/e-mail de convidado, por exemplo.

### Retenção e exclusão

- Exclusão de conta é **soft delete** (`weddings.deleted_at`): os dados somem do
  produto na hora, mas ficam recuperáveis por até 30 dias mediante contato com o
  suporte.
- Após 30 dias, a rota agendada `/api/cron/purge-accounts` (Vercel Cron, diária)
  primeiro apaga os **arquivos de verdade no Storage** (fotos, documentos,
  contratos — `storage.objects` não tem cascade com as tabelas da aplicação, então
  isso precisa ser feito à parte) e só depois chama
  `fn_purge_soft_deleted_accounts()` pra apagar o usuário em `auth.users`; como
  toda tabela do casamento referencia essa conta em cascata (`ON DELETE CASCADE`),
  o restante (checklist, convidados, financeiro, site, lista de presentes etc.) é
  apagado automaticamente. Substituiu o agendamento antigo via `pg_cron` puro, que
  não limpava o Storage (achado da revisão jurídica de 2026-07).

### Direitos do titular já suportados hoje

- **Exclusão** — botão de exclusão de conta no painel, com o aviso de que os dados
  do casamento atual serão apagados (ver acima).
- **Exportação** — botão "Exportar meus dados" no perfil baixa um **JSON completo**
  com todos os dados pessoais do casamento (perfil, assinatura, convidados,
  checklist, financeiro, presentes, padrinhos, mesas, site, metadados de
  arquivos/fotos, preferências, membros e convites) — não só a lista de
  convidados como antes.
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

Convenções de código, estrutura de pastas e padrões de banco de dados estão em
[`CLAUDE.md`](./CLAUDE.md).
