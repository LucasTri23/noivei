'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationStore } from '@/store/navigation.store'

const SAFETY_TIMEOUT_MS  = 8000
const TRICKLE_DURATION_MS = 1400
const TRICKLE_TARGET_PCT  = 85
const FADE_OUT_MS         = 250

function TopProgressBarInner() {
  const isNavigating    = useNavigationStore((state) => state.isNavigating)
  const startNavigating = useNavigationStore((state) => state.startNavigating)
  const stopNavigating  = useNavigationStore((state) => state.stopNavigating)
  const pathname        = usePathname()
  const searchParams    = useSearchParams()
  const routeKeyRef     = useRef(`${pathname}?${searchParams.toString()}`)
  const [width, setWidth]     = useState(0)
  const [opacity, setOpacity] = useState(0)

  // Listener global em vez de instrumentar cada <Link>: o Link do Next renderiza
  // um <a> comum, então um único listener no document cobre toda navegação interna
  // sem precisar tocar em cada componente que usa <Link>.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (href === pathname) return

      startNavigating()
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname, startNavigating])

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams.toString()}`
    if (routeKeyRef.current !== routeKey) {
      routeKeyRef.current = routeKey
      stopNavigating()
    }
  }, [pathname, searchParams, stopNavigating])

  // Rede de segurança: se a navegação falhar ou for cancelada, o pathname nunca
  // muda e a barra ficaria travada em 85% para sempre sem isso.
  useEffect(() => {
    if (!isNavigating) return
    const timeout = setTimeout(stopNavigating, SAFETY_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [isNavigating, stopNavigating])

  useEffect(() => {
    if (isNavigating) {
      const raf = requestAnimationFrame(() => {
        setOpacity(1)
        setWidth(TRICKLE_TARGET_PCT)
      })
      return () => cancelAnimationFrame(raf)
    }

    const bumpTimer  = setTimeout(() => setWidth(100), 0)
    const fadeTimer  = setTimeout(() => setOpacity(0), FADE_OUT_MS)
    const resetTimer = setTimeout(() => setWidth(0), FADE_OUT_MS + 200)
    return () => {
      clearTimeout(bumpTimer)
      clearTimeout(fadeTimer)
      clearTimeout(resetTimer)
    }
  }, [isNavigating])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', top: 0, left: 0, height: '3px',
        zIndex: 'var(--z-toast)', pointerEvents: 'none',
        width: `${width}%`,
        opacity,
        background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color))',
        transition: isNavigating
          ? `width ${TRICKLE_DURATION_MS}ms var(--ease-default)`
          : `width 200ms var(--ease-default), opacity ${FADE_OUT_MS}ms var(--ease-default)`,
      }}
    />
  )
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  )
}
