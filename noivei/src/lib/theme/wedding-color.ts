// Deriva a escala de cores do casamento a partir da cor única escolhida pelo casal.
// Apenas matemática de HSL — sem dependências externas.

export interface WeddingColorScale {
  color:  string
  light:  string
  dark:   string
  subtle: string
}

interface HSL {
  h: number
  s: number
  l: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hexToHsl(hex: string): HSL | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) return null

  const int = parseInt(match[1], 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r)      h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else                h = (r - g) / d + 4
  h = (h * 60 + 360) % 360

  return { h, s, l }
}

function hslToHex({ h, s, l }: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }

  const toHex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Gera as variantes claro/escuro/fundo-suave da cor do casamento
 * ajustando a luminosidade em HSL (mesma proporção da paleta dourada padrão).
 * Retorna a escala dourada padrão se o hex for inválido.
 */
export function deriveWeddingColorScale(hex: string): WeddingColorScale {
  const hsl = hexToHsl(hex)
  if (!hsl) {
    return { color: '#C6943A', light: '#E0B870', dark: '#9A7020', subtle: '#FBF0E0' }
  }

  const { h, s, l } = hsl

  return {
    color:  hslToHex({ h, s, l }),
    light:  hslToHex({ h, s: clamp(s + 0.08, 0, 1), l: clamp(l + 0.17, 0, 0.92) }),
    dark:   hslToHex({ h, s: clamp(s + 0.1, 0, 1),  l: clamp(l - 0.14, 0.08, 1) }),
    subtle: hslToHex({ h, s: clamp(s + 0.2, 0, 0.85), l: 0.93 }),
  }
}
