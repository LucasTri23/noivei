/** Valida o preenchimento e formato, sem consultar a situação cadastral. */
export function normalizeCnpj(value: string): string {
  return value.trim().replace(/[./\-\s]/g, '').toUpperCase()
}
export function isCnpj(value: string): boolean {
  return /^[A-Z0-9]{12}[0-9]{2}$/.test(normalizeCnpj(value))
}
