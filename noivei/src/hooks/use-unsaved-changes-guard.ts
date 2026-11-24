'use client'

import { useEffect } from 'react'

const DEFAULT_MESSAGE = 'Você tem alterações não salvas. Sair mesmo assim? As alterações serão perdidas.'

/**
 * Avisa antes de perder alterações não salvas: ao fechar/recarregar a aba
 * (beforeunload) e ao clicar em links internos do app (menu lateral, navegação
 * inferior…). O listener de clique fica na fase de captura do document, então roda
 * antes do handler do <Link> do Next e consegue cancelar a navegação.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!dirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [dirty, message])
}
