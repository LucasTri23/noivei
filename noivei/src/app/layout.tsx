import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  variable: '--font-display',
  display:  'swap',
  weight:   ['400', '500', '600', '700', '800'],
})

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-body',
  display:  'swap',
  weight:   ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://noivei.com.br'),
  title: {
    default:  'noivei — Organize seu casamento do jeito certo',
    template: '%s | noivei',
  },
  description:
    'O único lugar onde você organiza todo o seu casamento. ' +
    'Checklist, convidados, financeiro, fornecedores, site e RSVP — tudo em um só lugar.',
  keywords: ['organizar casamento', 'app casamento', 'checklist casamento', 'lista convidados'],
  authors:  [{ name: 'noivei' }],
  openGraph: {
    type:     'website',
    locale:   'pt_BR',
    siteName: 'noivei',
  },
  twitter: { card: 'summary_large_image' },
  robots:  { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor:    '#7C9E6F',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} ${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--fg)] antialiased">
        <a href="#main-content" className="skip-link">
          Ir para o conteúdo principal
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
