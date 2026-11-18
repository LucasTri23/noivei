const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Só URLs absolutas http(s)/mailto passam — javascript:, data:, vbscript:,
 * caminhos relativos e qualquer coisa que não seja URL válida viram null
 * (o link é renderizado como texto simples).
 */
export function toSafeLinkHref(raw: string | null | undefined): string | null {
  if (!raw) return null
  const candidate = raw.trim()
  // Caracteres de controle/espaço no meio são truque comum para enganar parsers.
  if (!candidate || /[\u0000-\u001f\u007f\s]/.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null
    if (url.protocol !== 'mailto:' && !url.hostname) return null
    return url.href
  } catch {
    return null
  }
}
