'use client'

import { useEffect, useRef } from 'react'

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

// Widget "não sou um robô" (Cloudflare Turnstile) — usado no cadastro pra dificultar
// criação de contas em massa por bot. O site key é público de propósito (é assim que
// o Turnstile funciona: quem valida de verdade é o secret key, no servidor do
// Supabase Auth, configurado em Authentication > Attack Protection do painel).
//
// Sem API imperativa de reset por ref — o token do Turnstile é de uso único, então
// pra pedir um novo depois de um erro de submit o chamador troca a `key` deste
// componente (força o React a desmontar/remontar, criando um widget/token novo do
// zero), em vez de expor um ref (evita o lint react-hooks/refs sobre ler ref.current
// dentro do onSubmit que o handleSubmit do react-hook-form recebe durante o render).
//
// Usa refs internas (não closures presas via deps do useEffect) só pra callback/
// expire sempre chamarem a versão mais recente sem precisar recriar o script/widget
// a cada re-render do formulário pai — o widget em si é criado uma única vez, ao montar.
export default function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onVerifyRef   = useRef(onVerify)
  const onExpireRef   = useRef(onExpire)

  // Atualiza as refs depois do render (nunca durante) — só pra callback/expired-
  // callback do Turnstile sempre chamarem a versão mais recente, sem precisar
  // recriar o script/widget (efeito abaixo, que só roda uma vez) a cada re-render.
  useEffect(() => { onVerifyRef.current = onVerify }, [onVerify])
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) {
      console.error('[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY não configurado.')
      return
    }

    let cancelled = false
    let rendered  = false

    function renderWidget() {
      if (cancelled || rendered || !window.turnstile || !containerRef.current) return
      rendered = true
      window.turnstile.render(containerRef.current, {
        sitekey:  siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        'expired-callback': () => onExpireRef.current?.(),
      })
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (window.turnstile) {
      renderWidget()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderWidget)
    } else {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.addEventListener('load', renderWidget)
      document.head.appendChild(script)
    }

    return () => { cancelled = true }
  }, [])

  return <div ref={containerRef} />
}
