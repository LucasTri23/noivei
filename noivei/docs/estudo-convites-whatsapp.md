# Estudo técnico — Convites via WhatsApp

> Documento de pesquisa, sem implementação. Item 5 do roadmap V1.1. Revisitar antes
> de decidir construir — baseado no estado do código em 2026-08.

## Contexto atual do produto

Hoje o convite já é enviado "por WhatsApp" no sentido de que o casal copia o link
de RSVP (`/rsvp/[token]`) e cola numa conversa manualmente (não existe integração
de API nenhuma) — o link em si não tem nenhuma imagem/preview dinâmico configurado:
a página não define `generateMetadata` nem tags de Open Graph, e o projeto não tem
`@vercel/og` (ou equivalente) como dependência. Ou seja, colar o link hoje no
WhatsApp mostra um preview genérico ou nenhum preview, sem foto/nome do casal.

## O que pode ser implementado

### 1. Open Graph com preview dinâmico (sem depender da API oficial do WhatsApp)

WhatsApp (como a maioria dos apps de mensagem) lê as tags `og:title`/`og:description`/
`og:image` da página ao gerar o preview do link — isso é padrão de navegador/protocolo
aberto, não depende de nenhuma API paga ou aprovação do WhatsApp. Dá pra implementar:

- `generateMetadata` dinâmico em `/rsvp/[token]` e `/convite/[token]` retornando
  `openGraph: { title: nomeDoCasal, description: dataDoCasamento, images: [...] }`.
- Imagem dinâmica via `@vercel/og` (`ImageResponse`, roda em Edge Runtime, gera PNG
  em tempo real a partir de JSX/CSS) — precisaria virar uma NOVA dependência do
  projeto (não existe hoje), mas é leve e mantida pela própria Vercel, hospedagem
  já usada pelo projeto. Uma rota `/rsvp/[token]/opengraph-image.tsx` bastaria (é
  uma convenção nativa do App Router do Next.js, sem infraestrutura extra).
- Isso é **puramente do lado do servidor/navegador** — não depende da API oficial
  do WhatsApp, funciona hoje mesmo sem nenhuma aprovação de conta comercial.

### 2. Link personalizado bonito

Já existe: `/rsvp/[token]`. O que falta é só o preview (item acima) — o link em si
já é único por convidado, já não expõe nome nem telefone na URL.

### 3. QR Code

Já existe infraestrutura pra isso no projeto: o pacote `qrcode` já é usado (mural de
fotos e ingresso de check-in geram QR server-side). Gerar um QR do link de RSVP
seria reaproveitar o mesmo padrão já estabelecido — baixo esforço, sem dependência
nova.

### 4. Mensagem automática (texto pré-preenchido)

Dá pra montar um link do tipo `https://wa.me/<telefone>?text=<mensagem
codificada>` que abre o WhatsApp do PRÓPRIO CASAL com uma mensagem pronta pra cada
convidado (nome do convidado interpolado, texto convite + link de RSVP) — o casal
ainda aperta "enviar" manualmente, mas não precisa digitar nada. Isso é só um link
`wa.me`, documentado publicamente pela Meta, sem custo e sem aprovação de conta
comercial — funciona porque é o PRÓPRIO WhatsApp pessoal do usuário abrindo, não
uma API enviando em nome do produto.

### 5. Botão de RSVP dentro da conversa

Isso já é mais estrutural pra API oficial (ver limitações abaixo) — no fluxo
"wa.me" acima não existe botão dentro da mensagem, só texto + link clicável (que
já leva direto pra tela de RSVP, então o efeito prático é quase o mesmo).

## O que depende da API oficial (WhatsApp Business Platform / Cloud API)

Envio automático (o produto mandando a mensagem sozinho, sem o casal abrir o
WhatsApp e apertar enviar) exige a API oficial da Meta, e isso traz um conjunto
de limitações reais que pesam na decisão:

- **Conta comercial verificada** (WhatsApp Business Account) + processo de
  aprovação da Meta, que pode levar dias/semanas e ser recusado.
- **Templates de mensagem pré-aprovados**: fora da janela de 24h de conversa
  iniciada pelo destinatário, só é permitido enviar mensagens usando um
  "template" pré-cadastrado e aprovado pela Meta — não dá pra mandar texto livre
  gerado na hora (ex.: "Olá {{nome}}, você foi convidado para o casamento de..."
  precisa ser um template fixo com variáveis, aprovado antes de usar).
- **Botões interativos** (tipo "Confirmar presença ✅ / Recusar ❌" dentro da
  própria mensagem) existem na API, mas também precisam estar dentro de um
  template aprovado — não é algo que se adiciona livremente.
- **Custo por mensagem**: a Meta cobra por conversa iniciada fora da janela de
  24h (varia por país/categoria), diferente do WhatsApp pessoal (`wa.me`), que é
  gratuito.
- **Número de telefone dedicado**: precisa de um número que não esteja em uso no
  WhatsApp pessoal/Business App comum, migrado pra API.
- **Provedor intermediário**: a Meta não vende acesso direto de forma simples pra
  quem está começando — normalmente passa por um BSP (Business Solution
  Provider, ex. Twilio, Zenvia, Gupshup) que cobra a própria taxa em cima da
  cobrança da Meta.

Ou seja: o caminho da API oficial resolve "enviar automático pro convidado sem o
casal precisar abrir o WhatsApp", mas troca isso por custo recorrente, aprovação
prévia de conteúdo, e complexidade operacional (conta comercial, provedor,
templates) — desproporcional ao estágio atual do produto (mesma lógica já aplicada
neste projeto pra não recomendar infraestrutura de escala antes da hora).

## Recomendação

Para o próximo ciclo, o que entrega mais valor por menos esforço/risco é:
Open Graph dinâmico (item 1) + link `wa.me` com mensagem pré-preenchida (item 4) +
QR code reaproveitando o que já existe (item 3). Nenhum dos três precisa de conta
comercial aprovada, provedor terceiro ou custo por mensagem — e cobrem o essencial
do pedido original ("convite bonito", "mensagem automática", "QR code"). A API
oficial (envio automático de verdade, botão nativo dentro da mensagem) fica como
item de fase futura, condicionado a ter volume que justifique o custo/complexidade.
