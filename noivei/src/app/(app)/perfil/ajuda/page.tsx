import Link from 'next/link'
import SupportContactForm from '@/components/perfil/support-contact-form'

export const metadata = { title: 'Ajuda' }

const GENERAL_FAQ = [
  {
    q: 'Como convido meu parceiro(a) para editar o casamento?',
    a: 'O acesso compartilhado está disponível nos planos Ideal (até 5 usuários) e Exclusivo (até 10 usuários). Em Perfil → Membros você envia um convite por e-mail direto pelo app.',
  },
  {
    q: 'Como cancelo minha assinatura?',
    a: 'Acesse Perfil → Ver planos e selecione o plano Gratuito a qualquer momento. Nos planos de pagamento único não há renovação: o acesso simplesmente permanece válido até o período contratado após a data do casamento.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Seus dados ficam armazenados com criptografia e isolados por conta — só você acessa as informações do seu casamento. Seguimos a LGPD: você pode exportar seus dados ou excluir sua conta quando quiser, na tela de Perfil.',
  },
  {
    q: 'Os convidados precisam criar conta para confirmar presença?',
    a: 'Não. Cada convidado recebe um link único de RSVP e confirma (ou recusa) em segundos, sem cadastro. Você acompanha as respostas em tempo real na aba Convidados.',
  },
  {
    q: 'O que acontece com meu plano depois do casamento?',
    a: 'Nos planos pagos (Ideal e Exclusivo, mensal ou pagamento único), o casamento fica disponível por até 1 ano após a data do evento — tempo de sobra para exportar relatórios, listas e memórias. No Gratuito, por 30 dias após o casamento. Passado esse prazo, a conta é excluída seguindo o mesmo processo de qualquer exclusão.',
  },
]

// Uma pergunta por módulo do sidebar — explica o que cada tela faz e como
// adicionar as coisas nela, pra quem chegou agora e ainda tá se localizando.
const MODULES_FAQ = [
  {
    q: 'O que eu faço na tela de Início?',
    a: 'Aqui não tem nada pra adicionar — é o resumo do seu progresso. Você acompanha o Wedding Score, uma pontuação de 0 a 100 calculada automaticamente a partir do que você já fez em 7 áreas (Checklist, Financeiro, Convidados, RSVP, Mesas, Presentes e Arquivos), além de um gráfico mostrando essa evolução ao longo do tempo. A pontuação sobe sozinha conforme você usa as outras telas do app.',
  },
  {
    q: 'O que eu faço na tela de Checklist?',
    a: 'É a lista de tarefas do seu planejamento, gerada automaticamente com base nas respostas do questionário de onboarding e organizada por categoria e prazo. Você marca cada tarefa como concluída conforme avança e pode adicionar tarefas personalizadas a qualquer momento. Se a data do casamento mudar, os prazos são recalculados automaticamente.',
  },
  {
    q: 'Pra que serve a tela de Timeline?',
    a: 'A Timeline mostra as mesmas tarefas da Checklist, só que organizadas em ordem cronológica. É útil quando você quer enxergar o que vem antes e depois no seu planejamento, em vez de ver por categoria. Qualquer alteração feita na Checklist aparece automaticamente aqui também.',
  },
  {
    q: 'Como eu adiciono convidados e envio o convite de confirmação?',
    a: 'Na tela de Convidados você cadastra cada pessoa manualmente com nome, telefone, e-mail (opcional) e acompanhantes. Assim que adicionado, cada convidado ganha um link único de RSVP que você pode enviar direto pelo WhatsApp, sem sair do app. O convidado não precisa criar conta: só abre o link e confirma ou recusa a presença, e você acompanha as respostas em tempo real.',
  },
  {
    q: 'O que eu faço na tela de Financeiro?',
    a: 'É onde você controla o orçamento do casamento: lança despesas, organiza por categorias e fornecedores, e acompanha parcelas. Você também pode registrar cotações e orçamentos recebidos de fornecedores, anexando arquivos de até 50MB — esses anexos vão automaticamente para a aba Arquivos, sem precisar subir de novo.',
  },
  {
    q: 'O que eu faço na tela de Padrinhos & Entradas?',
    a: 'Aqui você organiza quem vai compor a cerimônia: padrinhos, madrinhas, daminhas e pajens. Você adiciona cada um deles e define a ordem de entrada na cerimônia, garantindo que no dia do casamento ninguém fique perdido sobre a hora certa de entrar.',
  },
  {
    q: 'Como eu organizo os convidados nas mesas?',
    a: 'Na tela de Mesas você distribui os convidados já confirmados entre as mesas do salão de festa. É só arrastar e soltar cada convidado na mesa desejada, montando o layout do seu jeito antes do grande dia.',
  },
  {
    q: 'O que eu faço na tela de Site do casal?',
    a: 'Aqui você personaliza a página pública do seu casamento para compartilhar com os convidados, com todas as informações do evento. Também é possível incorporar um mural de fotos diretamente no site, deixando tudo centralizado em um único link.',
  },
  {
    q: 'Como funciona a lista de Presentes?',
    a: 'Você monta sua lista de presentes vinculando cada item a uma loja externa por meio de um link. Opcionalmente, também dá pra cadastrar itens que o convidado paga direto pelo aplicativo, via Mercado Pago, sem precisar sair do app pra concluir o presente.',
  },
  {
    q: 'O que eu guardo na tela de Arquivos?',
    a: 'É a central de documentos do seu casamento. Contratos assinados ficam em uma categoria própria, os orçamentos anexados lá no Financeiro chegam aqui automaticamente, e você ainda pode subir outros documentos que quiser guardar em um só lugar.',
  },
  {
    q: 'Pra que serve a tela de Portaria?',
    a: 'A Portaria é a ferramenta pra usar na recepção no dia do casamento. Com ela, você valida a entrada dos convidados confirmados lendo o QR code do convite deles ou buscando pelo nome, agilizando o check-in na entrada do evento.',
  },
  {
    q: 'Como funciona o Álbum de fotos?',
    a: 'O Álbum é o mural onde convidados e o casal sobem as fotos tiradas no casamento. Ele fica aberto para novos envios entre o dia do casamento e o dia seguinte; depois disso, fecha para novos uploads, mas todas as fotos já enviadas continuam disponíveis normalmente.',
  },
  {
    q: 'O que eu configuro na tela de Perfil?',
    a: 'No Perfil ficam as configurações da sua conta: dados do casamento como nome e data (você pode alterar a data até 3 vezes, e ela trava de vez depois que já passou), aparência do app, membros com acesso compartilhado, notificações, segurança da senha, seu plano de assinatura e esta área de ajuda.',
  },
]

function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
      {items.map((item, idx) => (
        <details
          key={item.q}
          style={{ borderBottom: idx < items.length - 1 ? '1px solid #F8F3EE' : 'none' }}
        >
          <summary
            style={{
              padding: '16px 20px', cursor: 'pointer', listStyle: 'none',
              fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)',
            }}
          >
            {item.q}
          </summary>
          <p style={{ padding: '0 20px 16px', margin: 0, fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6 }}>
            {item.a}
          </p>
        </details>
      ))}
    </div>
  )
}

export default function AjudaPage() {
  return (
    <div style={{ maxWidth: '720px' }}>
      <Link href="/perfil" style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textDecoration: 'none' }}>
        ← Voltar ao perfil
      </Link>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: 'var(--fg)', margin: '10px 0 6px' }}
      >
        Ajuda
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 24px' }}>
        Perguntas frequentes sobre o Wednest.
      </p>

      <FaqList items={GENERAL_FAQ} />

      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--fg)', margin: '28px 0 12px' }}>
        Como usar cada tela
      </h2>
      <FaqList items={MODULES_FAQ} />

      <div
        className="rounded-2xl bg-[var(--surface)] p-6 mt-4"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
      >
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>Não encontrou o que procurava?</div>
        <div style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: '2px 0 18px' }}>
          Escreva pra gente — nossa equipe responde em até 1 dia útil.
        </div>
        <SupportContactForm />
      </div>
    </div>
  )
}
