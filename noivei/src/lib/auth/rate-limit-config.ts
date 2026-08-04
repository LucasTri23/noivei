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
} as const

export type AuthRateLimitAction = keyof typeof AUTH_RATE_LIMITS
