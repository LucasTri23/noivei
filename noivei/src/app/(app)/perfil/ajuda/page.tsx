import Link from 'next/link'

export const metadata = { title: 'Ajuda' }

const FAQ = [
  {
    q: 'Como convido meu parceiro(a) para editar o casamento?',
    a: 'O acesso compartilhado está disponível nos planos Premium (até 5 usuários) e Premium Plus (até 10 usuários). Em breve você poderá enviar um convite por e-mail direto pelo app — enquanto isso, vocês podem usar a mesma conta.',
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
    a: 'No Premium de pagamento único, o acesso vale até 1 ano após a data do casamento. No Premium Plus, por um período estendido após o grande dia — tempo de sobra para exportar relatórios, listas e memórias.',
  },
]

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
        Perguntas frequentes sobre o Noivei.
      </p>

      <div className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {FAQ.map((item, idx) => (
          <details
            key={item.q}
            style={{ borderBottom: idx < FAQ.length - 1 ? '1px solid #F8F3EE' : 'none' }}
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

      <div
        className="rounded-2xl bg-[var(--surface)] p-6 mt-4"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>Não encontrou o que procurava?</div>
          <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
            Nossa equipe responde em até 1 dia útil.
          </div>
        </div>
        <a
          href="mailto:contato@noivei.com.br?subject=Preciso%20de%20ajuda%20no%20Noivei"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff',
            borderRadius: '12px', padding: '12px 20px',
            fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          }}
        >
          Fale conosco
        </a>
      </div>
    </div>
  )
}
