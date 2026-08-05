'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    question: 'Posso começar gratuitamente?',
    answer: 'Sim. O plano Gratuito não expira e não pede cartão de crédito — vocês podem usar o checklist, a timeline e o RSVP (até 100 convidados) por quanto tempo quiserem.',
  },
  {
    question: 'Posso mudar de plano depois?',
    answer: 'Sim, a qualquer momento em Perfil > Planos. Vocês podem fazer upgrade quando o planejamento crescer, sem perder o que já foi cadastrado.',
  },
  {
    question: 'Meus convidados precisam criar conta?',
    answer: 'Não, nunca. Confirmação de presença, presentes e envio de fotos no álbum funcionam por link ou QR code individual — sem cadastro nem senha para o convidado.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim. Planos mensais podem ser cancelados a qualquer momento, sem multa — a cobrança para e o casal volta automaticamente para o plano Gratuito. Planos de pagamento único não recorrem, então não há cobrança futura para cancelar.',
  },
  {
    question: 'Quanto tempo tenho acesso?',
    answer: 'Em planos mensais, o acesso aos recursos pagos continua enquanto a assinatura estiver ativa. Em planos de pagamento único, o acesso segue liberado após a confirmação do pagamento, sem uma data de expiração automática.',
  },
  {
    question: 'Como funciona a lista de presentes?',
    answer: 'O casal cadastra os itens desejados com um link de loja externa ou permite que o próprio convidado pague direto pelo app via Mercado Pago — o valor cai direto na conta do casal.',
  },
] as const

/**
 * Acordeão de perguntas frequentes sobre planos — copy fiel aos fatos reais do
 * produto (ver noivei/AGENTS.md do redesign). Reutilizável, sem depender de dados
 * externos.
 */
export default function PlanFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section
      className="mx-auto"
      style={{ maxWidth: '840px', padding: 'clamp(40px, 6vw, 80px) clamp(20px, 4vw, 44px)' }}
    >
      <h2
        className="font-display text-center"
        style={{ fontWeight: 500, fontSize: 'clamp(26px, 3.4vw, 38px)', lineHeight: 1.14, color: 'var(--fg)', margin: '0 0 clamp(28px, 4vw, 40px)' }}
      >
        Perguntas frequentes
      </h2>

      <div className="flex flex-col" style={{ gap: '12px' }}>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index
          const panelId = `plan-faq-panel-${index}`
          const buttonId = `plan-faq-button-${index}`

          return (
            <div
              key={item.question}
              className="rounded-2xl"
              style={{
                background: 'var(--surface)',
                boxShadow: '0 8px 22px rgba(60,40,24,0.06)',
                border: '1px solid color-mix(in srgb, var(--wedding-color) 10%, transparent)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between text-left"
                style={{
                  padding: 'clamp(16px, 2vw, 20px) clamp(18px, 2.4vw, 24px)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  gap: '16px',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg)' }}>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="flex flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: '26px',
                    height: '26px',
                    background: 'var(--wedding-color-subtle)',
                    color: 'var(--wedding-color-dark)',
                    fontSize: '15px',
                    fontWeight: 700,
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.18s',
                  }}
                >
                  +
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                style={{ padding: isOpen ? '0 clamp(18px, 2.4vw, 24px) clamp(16px, 2vw, 20px)' : '0' }}
              >
                <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.65, margin: 0 }}>
                  {item.answer}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
