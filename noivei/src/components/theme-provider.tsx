'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    // enableColorScheme desligado de propósito: por padrão o next-themes escreve
    // `style="color-scheme: dark"` no <html> quando o tema escuro está ativo. Isso
    // pede pro NAVEGADOR (não pro nosso CSS) desenhar o fundo nativo de controles
    // sem background explícito (inputs/selects sem `background` definido, como o
    // campo de hex em AppearanceSettings) — e o "dark" nativo do Chrome/Firefox é
    // um cinza quase preto, não o marrom da paleta em `[data-theme="dark"]`
    // (globals.css). É essa propriedade — não as CSS vars `--bg`/`--surface`, que
    // já estão corretas — que fazia partes da UI "vazarem" para preto no modo
    // escuro. Como todo componente aqui já define sua própria paleta via
    // `var(--surface)`/`var(--fg)` etc., não precisamos do color-scheme nativo do
    // navegador — ele só atrapalha.
    <NextThemesProvider attribute="data-theme" defaultTheme="light" enableSystem={false} enableColorScheme={false}>
      {children}
    </NextThemesProvider>
  )
}
