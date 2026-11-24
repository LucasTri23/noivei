import localFont from 'next/font/local'

import type { SiteFontPairId } from '@/lib/site/customization'

// Pares de fontes do site do casal (arquivos OFL em src/app/fonts/site, subconjunto
// latin — cobre todos os acentos do português). Fontes locais e não next/font/google
// pelo mesmo motivo do layout raiz (o build de produção não depende de rede).
// `preload: false`: as 6 combinações ficam declaradas, mas o navegador só baixa as
// do par realmente usado na página.

const playfair = localFont({
  src: [
    { path: '../../app/fonts/site/playfair-display.woff2', weight: '400 900', style: 'normal' },
    { path: '../../app/fonts/site/playfair-display-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--site-font-playfair', display: 'swap', preload: false, fallback: ['Georgia', 'serif'],
})
const sourceSans = localFont({
  src: '../../app/fonts/site/source-sans-3.woff2', weight: '200 900',
  variable: '--site-font-source-sans', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})
const fraunces = localFont({
  src: [
    { path: '../../app/fonts/site/fraunces.woff2', weight: '100 900', style: 'normal' },
    { path: '../../app/fonts/site/fraunces-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--site-font-fraunces', display: 'swap', preload: false, fallback: ['Georgia', 'serif'],
})
const inter = localFont({
  src: '../../app/fonts/site/inter.woff2', weight: '100 900',
  variable: '--site-font-inter', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})
const bodoni = localFont({
  src: [
    { path: '../../app/fonts/site/bodoni-moda.woff2', weight: '400 900', style: 'normal' },
    { path: '../../app/fonts/site/bodoni-moda-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--site-font-bodoni', display: 'swap', preload: false, fallback: ['Didot', 'Georgia', 'serif'],
})
const jost = localFont({
  src: '../../app/fonts/site/jost.woff2', weight: '100 900',
  variable: '--site-font-jost', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})
const garamond = localFont({
  src: [
    { path: '../../app/fonts/site/eb-garamond.woff2', weight: '400 800', style: 'normal' },
    { path: '../../app/fonts/site/eb-garamond-italic.woff2', weight: '400 800', style: 'italic' },
  ],
  variable: '--site-font-garamond', display: 'swap', preload: false, fallback: ['Garamond', 'Georgia', 'serif'],
})
const montserrat = localFont({
  src: '../../app/fonts/site/montserrat.woff2', weight: '100 900',
  variable: '--site-font-montserrat', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})
const lora = localFont({
  src: [
    { path: '../../app/fonts/site/lora.woff2', weight: '400 700', style: 'normal' },
    { path: '../../app/fonts/site/lora-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--site-font-lora', display: 'swap', preload: false, fallback: ['Georgia', 'serif'],
})
const nunitoSans = localFont({
  src: '../../app/fonts/site/nunito-sans.woff2', weight: '200 1000',
  variable: '--site-font-nunito-sans', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})
const dmSerif = localFont({
  src: [
    { path: '../../app/fonts/site/dm-serif-display.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/site/dm-serif-display-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--site-font-dm-serif', display: 'swap', preload: false, fallback: ['Georgia', 'serif'],
})
const dmSans = localFont({
  src: '../../app/fonts/site/dm-sans.woff2', weight: '100 1000',
  variable: '--site-font-dm-sans', display: 'swap', preload: false, fallback: ['system-ui', 'sans-serif'],
})

type LoadedFont = { variable: string }

const PAIRS: Record<SiteFontPairId, { display: LoadedFont; body: LoadedFont; displayVar: string; bodyVar: string }> = {
  elegante:      { display: playfair, body: sourceSans, displayVar: '--site-font-playfair', bodyVar: '--site-font-source-sans' },
  moderno:       { display: fraunces, body: inter,      displayVar: '--site-font-fraunces', bodyVar: '--site-font-inter' },
  editorial:     { display: bodoni,   body: jost,       displayVar: '--site-font-bodoni',   bodyVar: '--site-font-jost' },
  atemporal:     { display: garamond, body: montserrat, displayVar: '--site-font-garamond', bodyVar: '--site-font-montserrat' },
  suave:         { display: lora,     body: nunitoSans, displayVar: '--site-font-lora',     bodyVar: '--site-font-nunito-sans' },
  contemporaneo: { display: dmSerif,  body: dmSans,     displayVar: '--site-font-dm-serif', bodyVar: '--site-font-dm-sans' },
}

/**
 * Classes (que declaram as @font-face do par) e as variáveis que trocam as fontes
 * de título e texto — os templates já usam --font-display/--font-body em tudo.
 */
export function siteFontPairStyle(pair: SiteFontPairId | undefined): { className?: string; style: Record<string, string> } {
  if (!pair) return { style: {} }
  const fonts = PAIRS[pair]
  return {
    className: `${fonts.display.variable} ${fonts.body.variable}`,
    style: { '--font-display': `var(${fonts.displayVar})`, '--font-body': `var(${fonts.bodyVar})`, fontFamily: `var(${fonts.bodyVar})` },
  }
}
