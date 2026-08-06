import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // camera=(self): a Portaria (checkin-scanner.tsx) precisa da câmera pra ler o QR
  // code do ingresso — "camera=()" bloqueava isso globalmente (nunca atualizado
  // quando esse recurso foi criado), fazendo a câmera falhar sempre em produção.
  // "self" ainda bloqueia qualquer iframe de terceiro pedir câmera nesse site.
  { key: 'Permissions-Policy',        value: 'camera=(self), microphone=(self), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.posthog.com https://challenges.cloudflare.com",
      // Widget do Cloudflare Turnstile (CAPTCHA de signup/login/esqueci-senha) renderiza
      // num iframe — sem essa diretiva cai em default-src 'self' e o iframe é bloqueado
      // silenciosamente (o widget nunca aparece, só o console acusa CSP violation).
      // https://*.supabase.co: preview de PDF em <iframe> na Central de arquivos usa a
      // signed URL do Storage — mesma classe de bug (bloqueio silencioso sem essa diretiva).
      "frame-src https://challenges.cloudflare.com https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // @react-pdf/renderer (usado no resumo de casamento por e-mail e na exportação de
  // dados em PDF) depende de fontkit/yoga-layout por baixo dos panos — deixando o
  // Next tentar empacotar isso normalmente no bundle da função serverless, o
  // carregamento quebra em produção na Vercel mesmo funcionando local (build e
  // testes rodam em Node puro, sem passar pelo bundle da function). Marcar como
  // pacote externo faz essas libs serem carregadas direto do node_modules em
  // runtime, sem o bundler mexer nelas.
  serverExternalPackages: ['@react-pdf/renderer'],

  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
