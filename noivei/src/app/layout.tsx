import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import QueryProvider from '@/components/query-provider'
import ThemeProvider from '@/components/theme-provider'
import ToastContainer from '@/components/ui/toast'
import TopProgressBar from '@/components/ui/top-progress-bar'
import './globals.css'

const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond.woff2', weight: '400 700', style: 'normal' },
    { path: './fonts/cormorant-garamond-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
})

const hanken = localFont({
  src: './fonts/hanken-grotesk.woff2',
  weight: '400 700',
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://wednest.com.br'),
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
        <QueryProvider>
          <ThemeProvider>
            <TopProgressBar />
            <a href="#main-content" className="skip-link">
              Ir para o conteúdo principal
            </a>
            <main id="main-content">{children}</main>
            <ToastContainer />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
