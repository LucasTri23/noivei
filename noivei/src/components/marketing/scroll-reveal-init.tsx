'use client'

import { useEffect } from 'react'

/**
 * Ativa o fade-in ao rolar para elementos marcados com `data-reveal` (ver
 * regra `.reveal-pending` em globals.css). Sem saída visual própria — só o
 * efeito. A classe `reveal-pending` só é adicionada aqui, em runtime, pra que
 * o conteúdo nunca fique invisível se o JS falhar (progressive enhancement).
 */
export default function ScrollRevealInit() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (elements.length === 0) return

    if (typeof IntersectionObserver === 'undefined') return

    elements.forEach((el) => el.classList.add('reveal-pending'))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return null
}
