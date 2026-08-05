// Limites de tentativa por ação de autenticação — únicos consumidores são as
// Route Handlers de login/signup/forgot-password (todas server-side). Nunca
// escolhido pelo cliente, só a ação (implícita na rota chamada).
export const AUTH_RATE_LIMITS = {
  login: {
    ip:         { max: 20, windowSeconds: 900 },
    identifier: { max: 8,  windowSeconds: 900 },
  },
  signup: {
    ip:         { max: 5, windowSeconds: 3600 },
    identifier: { max: 3, windowSeconds: 3600 },
  },
  forgot_password: {
    ip:         { max: 5, windowSeconds: 3600 },
    identifier: { max: 3, windowSeconds: 3600 },
  },
  // Código curto (força bruta é viável em poucas tentativas) — limite um pouco
  // mais generoso que login porque digitar errado por engano é comum, mas ainda
  // assim baixo o bastante pra inviabilizar adivinhação.
  verify_otp: {
    ip:         { max: 10, windowSeconds: 900 },
    identifier: { max: 6,  windowSeconds: 900 },
  },
  // Ação mais restrita do fluxo: dispara e-mail de verdade pra qualquer endereço
  // informado, sem provar posse antes do envio — abusável como spam pra terceiro.
  // `cooldown` é uma segunda chave própria (não consome as tentativas de
  // `identifier`) só pra impedir cliques repetidos em sequência no mesmo e-mail.
  resend_otp: {
    ip:         { max: 5, windowSeconds: 3600 },
    identifier: { max: 3, windowSeconds: 3600 },
    cooldown:   { max: 1, windowSeconds: 60 },
  },
} as const

export type AuthRateLimitAction = keyof typeof AUTH_RATE_LIMITS
