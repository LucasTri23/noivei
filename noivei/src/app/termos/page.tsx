import fs from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import '../legal-content.css'

export const metadata = { title: 'Termos de Uso' }

// Página pública (fora de (app)/(admin)/(auth) — sem exigir login, ver
// src/middleware.ts) que renderiza o Markdown já redigido em
// docs/legal/termos-de-uso.md. O arquivo é estático (faz parte do repositório,
// não muda em runtime), então lemos direto do disco em vez de duplicar o
// conteúdo aqui — uma única fonte de verdade para o texto legal.
export default async function TermosPage() {
  const filePath = path.join(process.cwd(), 'docs/legal/termos-de-uso.md')
  const content = await fs.readFile(filePath, 'utf-8')

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) 20px' }}>
      <Link
        href="/login"
        style={{ display: 'inline-block', marginBottom: '28px', fontSize: '14px', color: 'var(--muted-fg)', fontWeight: 600 }}
      >
        ← Voltar
      </Link>

      <div className="legal-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
