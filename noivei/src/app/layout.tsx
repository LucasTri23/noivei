import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Hanken_Grotesk } from 'next/font/google'
import ThemeProvider from '@/components/theme-provider'
import ToastContainer from '@/components/ui/toast'
import TopProgressBar from '@/components/ui/top-progress-bar'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  variable: '--font-display',
  display:  'swap',
  weight:   ['400', '500', '600', '700'],
  style:    ['normal', 'italic'],
})

const hanken = Hanken_Grotesk({
  subsets:  ['latin'],
  variable: '--font-body',
  display:  'swap',
  weight:   ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  // TODO: confirmar o domínio definitivo em produção (Vercel/DNS ainda apontam
  // pra config antiga) antes de trocar o fallback abaixo de noivei.com.br.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://noivei.com.br'),
  title: {
    default:  'Wednest — Organize seu casamento do jeito certo',
    template: '%s | Wednest',
  },
  description:
    'O único lugar onde você organiza todo o seu casamento. ' +
    'Checklist, convidados, financeiro, fornecedores, site e RSVP — tudo em um só lugar.',
  keywords: ['organizar casamento', 'app casamento', 'checklist casamento', 'lista convidados'],
  authors:  [{ name: 'Wednest' }],
  openGraph: {
    type:     'website',
    locale:   'pt_BR',
    siteName: 'Wednest',
  },
  twitter: { card: 'summary_large_image' },
  robots:  { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor:   '#C39A3E',
  width:        'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorant.variable} ${hanken.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--fg)] antialiased">
        <ThemeProvider>
          <TopProgressBar />
          <a href="#main-content" className="skip-link">
            Ir para o conteúdo principal
          </a>
          <main id="main-content">{children}</main>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  )
}
