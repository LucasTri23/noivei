'use client'

import { useEffect, useState } from 'react'

// Só sinaliza loading se a ação realmente demorar — evita spinner piscando em ações rápidas
export function useDelayedLoading(isLoading: boolean, delayMs = 1000): boolean {
  const [showSpinner, setShowSpinner] = useState(false)

  useEffect(() => {
    if (!isLoading) return undefined
    const timer = setTimeout(() => setShowSpinner(true), delayMs)
    return () => {
      clearTimeout(timer)
      setShowSpinner(false)
    }
  }, [isLoading, delayMs])

  return showSpinner
}
