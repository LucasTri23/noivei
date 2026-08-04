'use client'

// Error boundary de último recurso — o único que cobre erros dentro do próprio
// root layout.tsx (font, ThemeProvider, etc.), que src/app/(app)/error.tsx e
// outros error.tsx por grupo de rota NÃO alcançam (eles só envolvem o `children`
// do layout em que vivem, nunca o layout acima deles). Sem este arquivo, uma
// falha no root layout ainda cai na tela genérica de erro do browser/Next.js.
// Precisa renderizar <html>/<body> própprios porque substitui o root layout inteiro.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error('[app] erro não tratado no layout raiz:', error)

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#FBF7F2', color: '#3C2818' }}>
        <div
          style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>😥</div>
          <h1 style={{ fontWeight: 600, fontSize: '22px', margin: '0 0 8px' }}>Algo deu errado</h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px', maxWidth: '420px', lineHeight: 1.6 }}>
            Não foi possível carregar a página. Tente novamente em instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#C39A3E', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '11px 22px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
