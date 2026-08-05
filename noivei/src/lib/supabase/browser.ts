import { createBrowserClient } from '@supabase/ssr'
import type { Database }       from '@/types/database'

// ── Nota de segurança sobre cookies de sessão (SEC-006, auditoria) ──────────
//
// `secure: true` e `sameSite: 'lax'` são explícitos aqui (e nos clients de
// server.ts/middleware.ts — os 3 usam a MESMA cookieOptions, mantenha em
// sincronia se mudar). `httpOnly` NÃO é setado — o default do @supabase/ssr é
// `httpOnly: false`, e isso é INTENCIONAL, não um descuido:
//
// - Cookies precisam ser acessíveis pelo cliente (JS): sim, os de sessão do
//   Supabase (`sb-*-auth-token`) — é assim que `createSupabaseBrowser()`
//   funciona, lendo/gravando sessão direto no browser sem round-trip ao
//   servidor a cada chamada. Forçar `httpOnly: true` quebra esse client
//   inteiro (ele nunca mais leria a própria sessão).
// - Cookies que NÃO precisam ser acessíveis pelo cliente: nenhum cookie de
//   sessão hoje é usado exclusivamente por Server Components/Route
//   Handlers sem também precisar ser lido pelo browser client em algum
//   fluxo — não há cookie "só de servidor" candidato a httpOnly separado.
// - Proteção compensatória que já existe: `SameSite=Lax` (mitiga CSRF —
//   cookie não vai em request cross-site iniciado por outro site);
//   `Secure` (nunca trafega fora de HTTPS); nenhum uso de
//   `dangerouslySetInnerHTML` com dado não sanitizado em todo o projeto
//   (confirmado em auditoria — reduz a superfície de XSS que exploraria
//   isso); RLS como camada independente (mesmo que o token vazasse, RLS
//   ainda limita o que ele consegue ler/escrever no banco).
// - Risco que PERMANECE: se uma XSS aparecer em qualquer parte do app
//   (mesmo fora do fluxo de auth), o payload injetado pode fazer
//   `document.cookie` e exfiltrar o token de sessão. Mitigação real disso
//   não é mexer em `httpOnly` (incompatível com a arquitetura atual, como
//   acima) — é fechar a CSP (`next.config.ts` ainda tem `unsafe-inline` em
//   `script-src`, item separado de auditoria, corrigir antes de reduzir
//   esse risco de verdade) e manter a disciplina de nunca introduzir HTML
//   não sanitizado vindo de usuário.
//
// Singleton para Client Components (evitar múltiplos clients)
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createSupabaseBrowser() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: true, sameSite: 'lax' },
    },
  )

  return client
}
