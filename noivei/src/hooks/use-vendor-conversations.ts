'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VendorConversationListItem } from '@/lib/vendor/vendor-conversation-types'

export type { VendorConversationListItem }

// O botão "Conversar pelo Wednest" (vendor-contact-actions.tsx) precisa distinguir
// "não está logado" (401 → manda pro /login) de "logado mas sem casamento/módulo"
// (403 → avisa por toast) — um Error comum perde essa informação.
export class VendorConversationRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'VendorConversationRequestError'
  }
}

// Query keys centralizadas no próprio arquivo do hook, convenção de CLAUDE.md.
const keys = {
  all:  ['vendor-conversations'] as const,
  list: (as: 'couple' | 'vendor') => ['vendor-conversations', 'list', as] as const,
}

async function fetchVendorConversations(as: 'couple' | 'vendor'): Promise<VendorConversationListItem[]> {
  const res = await fetch(`/api/v1/vendor-conversations?as=${as}`, { cache: 'no-store' })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error?.message ?? 'Erro ao carregar conversas.')
  return body.data as VendorConversationListItem[]
}

/**
 * Lista as conversas do usuário — `as` decide qual ponta ("casal" ou "fornecedor")
 * exibir, pra uma conta híbrida (tem casamento E é fornecedor) não ver as duas
 * misturadas na mesma tela (ver GET /api/v1/vendor-conversations).
 */
export function useVendorConversations(as: 'couple' | 'vendor') {
  return useQuery({
    queryKey: keys.list(as),
    queryFn:  () => fetchVendorConversations(as),
  })
}

/**
 * Inicia (ou reabre, se já existir — UNIQUE(wedding_id, vendor_id)) uma conversa
 * com um fornecedor. Só o lado do CASAL chama isto (botão "Conversar pelo
 * Wednest" em /profissionais/[slug]).
 */
export function useCreateVendorConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vendorId: string): Promise<{ id: string }> => {
      const res = await fetch('/api/v1/vendor-conversations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vendor_id: vendorId }),
      })
      const body = await res.json()
      if (!res.ok) throw new VendorConversationRequestError(body?.error?.message ?? 'Erro ao iniciar conversa.', res.status)
      return body.data as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })
}
