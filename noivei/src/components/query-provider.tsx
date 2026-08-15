'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

// PRIMEIRO uso de TanStack Query neste projeto (CLAUDE.md já documentava a
// convenção — "Padrões para Hooks" — mas nenhum QueryClientProvider existia até o
// chat de fornecedores, Fase 4, que é a primeira tela cujo cache precisa ser
// atualizado por fora de uma mutation própria, via evento do Realtime, e não só
// por fetch/refetch — ver src/hooks/use-vendor-conversation-thread.ts). Provider
// no layout raiz (não só dentro do grupo (app)) porque a área do FORNECEDOR
// (grupo (vendor)) também consome os mesmos hooks de chat.
//
// `useState(() => new QueryClient())` (não uma constante no módulo): cada
// requisição de Server-Side Rendering precisa do seu próprio QueryClient — uma
// instância de módulo compartilhada vazaria cache entre requisições/usuários
// diferentes num ambiente com SSR.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Mensagens/conversas são atualizadas via Realtime + invalidação manual
            // (reconexão/foco) — refetch automático por "staleness" de tempo não é
            // o mecanismo principal aqui, mas manter refetchOnWindowFocus (default)
            // é útil como uma segunda rede de segurança independente do estado do
            // socket, então não é desligado.
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
