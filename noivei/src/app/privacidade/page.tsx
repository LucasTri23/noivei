import fs from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import '../legal-content.css'

export const metadata = { title: 'Política de Privacidade' }

// Página pública (fora de (app)/(admin)/(auth) — sem exigir login, ver
// src/middleware.ts) que renderiza o Markdown já redigido em
// docs/legal/politica-de-privacidade.md.
//
// A Política de Cookies (docs/legal/politica-de-cookies.md) é exibida logo
// abaixo, na mesma página, separada por um <hr> e um título próprio. Isso é
// intencional: o cadastro (src/app/(auth)/signup/page.tsx) só linka uma única
// URL de privacidade, e não há hoje um link separado para "/politica-de-cookies"
// em nenhuma tela do produto — então, em vez de criar uma terceira rota órfã
// sem nenhum link real apontando para ela, o conteúdo de cookies mora aqui até
// que exista um motivo concreto (ex.: banner de cookies) para separá-lo.
export default async function PrivacidadePage() {
  const [privacidade, cookies] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'docs/legal/politica-de-privacidade.md'), 'utf-8'),
    fs.readFile(path.join(process.cwd(), 'docs/legal/politica-de-cookies.md'), 'utf-8'),
  ])

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) 20px' }}>
      <Link
        href="/login"
        style={{ display: 'inline-block', marginBottom: '28px', fontSize: '14px', color: 'var(--muted-fg)', fontWeight: 600 }}
      >
        ← Voltar
      </Link>

      <div className="legal-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacidade}</ReactMarkdown>

        {/* Divisória + título "Política de Cookies": o próprio Markdown de
            cookies já abre com "# Política de Cookies — Wednest" (h1), então
            o <hr /> abaixo já cumpre o pedido de separação visual clara sem
            duplicar o título manualmente. */}
        <hr />

        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cookies}</ReactMarkdown>
      </div>
    </div>
  )
}
