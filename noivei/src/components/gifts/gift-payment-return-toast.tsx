'use client'

import { useEffect } from 'react'
import { toastError, toastSuccess } from '@/store/toast.store'

// Volta do checkout de presente no Mercado Pago (?presente=sucesso|falha|pendente,
// ver back_urls em /api/v1/gifts/[id]/checkout) — mesmo padrão de retorno usado em
// plan-selector.tsx pro checkout de assinatura.
export default function GiftPaymentReturnToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const presente = params.get('presente')
    if (!presente) return

    if (presente === 'sucesso') {
      toastSuccess('Presente enviado! Assim que o pagamento for confirmado, ele aparece como "já foi dado".')
    } else if (presente === 'pendente') {
      toastSuccess('Pagamento pendente de confirmação — assim que for aprovado, o presente é marcado como dado.')
    } else if (presente === 'falha') {
      toastError('Pagamento não foi concluído. Você pode tentar de novo quando quiser.')
    }

    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  return null
}
