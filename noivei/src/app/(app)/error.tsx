'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface AppErrorProps {
  error: Error & { digest?: string }
  reset:  () => void
}

// Error boundary do grupo (app) inteiro — cobre todas as páginas autenticadas
// (dashboard, checklist, convidados, financeiro, mesas, arquivos, presentes,
// padrinhos, checkin). Sem isso, uma exceção não tratada em QUALQUER página (ex:
// câmera do scanner de check-in, geração de PDF, upload de arquivo) sobe até o
// Next.js e derruba a navegação inteira — a pessoa cai na tela genérica de erro
// do browser em vez de ver algo recuperável dentro do próprio app. O layout (app)
// (sidebar, top bar) continua de pé — só o conteúdo da página é substituído por
// esta tela, já que este arquivo só envolve o `children` do layout, não o layout
// em si.
export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // Detalhe fica só no console (debug) — nunca expor stack trace na UI.
    console.error('[app] erro não tratado:', error)
  }, [error])

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl bg-[var(--surface)] p-10 text-center"
      style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', minHeight: '320px' }}
    >
      <div style={{ fontSize: '40px', marginBottom: '10px' }}>😥</div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: '24px', color: 'var(--fg)', margin: '0 0 8px' }}
      >
        Algo deu errado nesta página
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 0 24px', maxWidth: '420px', lineHeight: 1.6 }}>
        Não foi possível carregar esta parte do app. Tente novamente — se o problema continuar,
        volte para o painel e tente de novo em instantes.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'var(--wedding-color, #C39A3E)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 22px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          style={{
            background: 'var(--wedding-color-subtle, #F4EFE7)', color: 'var(--wedding-color-dark, #9A7020)',
            textDecoration: 'none', borderRadius: '12px', padding: '11px 22px', fontWeight: 600, fontSize: '14px',
          }}
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  )
}
